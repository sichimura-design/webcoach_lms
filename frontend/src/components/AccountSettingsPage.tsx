import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Eye, EyeOff, CheckCircle2, Lock, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { changePassword, updateEmail, verifyEmailChange } from '../services/cognitoAuth';
import { AppFooter, AppHeader } from './shared';
import { resolveAvatarUrl, withCfToken } from './profile/AvatarPicker';
import SettingsAvatar from './profile/SettingsAvatar';
import {
  CONTENT_MAX_WIDTH,
  dcCard,
  dcChevron,
  dcHint,
  dcIconBadge,
  dcInput,
  dcOutlineButton,
  dcPageLead,
  dcPageTitle,
  dcPrimaryButton,
  dcRowLabel,
  focusRing,
} from './profile/settingsStyles';

/**
 * アカウント設定（/account-settings）。
 * claude.ai/design『学習画面デザイン案.dc.html』2a「設定ハブ」準拠。
 *
 * 【レイアウト方式】
 * 🔴 サイドバーは AppHeader.tsx（既存モック）をそのまま使う。デザイン 2a は 240px の
 *    赤サイドバーが常時展開した絵だが、実装は 72px レール ⇄ 224px パネルの push 型で、
 *    アカウントのポップオーバー（アカウント設定 / プロフィール）も既に一致している。
 *    本文の左余白は body.with-sidebar（index.css）が持つので、ここで足さない。
 * 🔴 中央寄せの 480px 白カード＋放射グラデの玉だった旧デザインは廃止。
 *    マイページ（5a）・学習記録（4a）と同じ .wc-warm + dc-page-main に載せ替えた。
 *
 * 【構成】
 *   ① プロフィール（アバター・名前・メール・説明を1行に畳んだカード → /profile）
 *   ② ログイン情報（メールアドレス / パスワード。各行の「変更」で直下にフォームが開く）
 *   ③ ログアウト
 *
 * 🔴 ① はデザイン 2a では2枚のカード（88px アバターのヒーロー ＋ プロフィール行）に
 *    分かれているが、行き先も伝える内容も同じで縦を 200px 近く使っていたので1枚にした。
 *
 * 🔴 旧実装の mode ステートマシン（'main' | 'emailVerify' | 'success'）は廃止した。
 *    画面ごと差し替えると、変更中に一覧（＝いま何がどうなっているか）が消えてしまう。
 *    いまは openForm で開いている行の中だけが変化し、一覧は常に見えている。
 * 🔴 かつてここにあった AccountOverviewCard は削除した。「学習記録」への行も一緒に
 *    無くなっているが、学習記録はトップの「詳しく見る」から /study-log へ行ける。
 *    設定画面は「設定を変える場所」に絞る（2a がそういう画面になっている）。
 */

type OpenForm = null | 'email' | 'password';

const passwordRules = [
  { label: '8文字以上', test: (p: string) => p.length >= 8 },
  { label: '大文字を含む', test: (p: string) => /[A-Z]/.test(p) },
  { label: '小文字を含む', test: (p: string) => /[a-z]/.test(p) },
  { label: '数字を含む', test: (p: string) => /[0-9]/.test(p) },
  { label: '記号を含む', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

/** Cognito のエラーコードを日本語にする。旧実装から引き継ぎ */
function toJapaneseError(e: any): string {
  switch (e?.code) {
    case 'NotAuthorizedException':
      return '現在のパスワードが正しくありません';
    case 'AliasExistsException':
      return 'このメールアドレスはすでに使用されています';
    case 'CodeMismatchException':
      return '確認コードが正しくありません';
    default:
      return e?.message || 'エラーが発生しました';
  }
}

/** ログイン情報カードの1行（ラベル / 現在値 / 変更ボタン）。下線は最後の行だけ無し */
function LoginRow({
  label,
  value,
  valueStyle,
  onEdit,
  active,
  divider,
  children,
}: {
  label: string;
  value: string;
  valueStyle?: React.CSSProperties;
  onEdit: () => void;
  active: boolean;
  divider: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div style={divider ? { borderBottom: '1px solid var(--dc-border)' } : undefined}>
      <div className="settings-field" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '20px 0 18px' }}>
        <span className="settings-field-label" style={{ ...dcRowLabel, width: 170 }}>{label}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, color: 'var(--dc-text-body)', ...valueStyle }}>
          {value}
        </span>
        <button
          type="button"
          onClick={onEdit}
          aria-expanded={active}
          className={`dc-cta-outline ${focusRing}`}
          style={{
            ...dcOutlineButton,
            ...(active ? { background: 'var(--dc-soft-100)' } : null),
          }}
        >
          {active ? '閉じる' : '変更'}
        </button>
        <ChevronRight
          size={17}
          strokeWidth={2}
          style={{
            ...dcChevron,
            transform: active ? 'rotate(90deg)' : undefined,
            transition: 'transform 160ms var(--dc-ease)',
          }}
        />
      </div>
      {children}
    </div>
  );
}

function AccountSettingsPage() {
  const navigate = useNavigate();
  const { user, nickName, avatarUrl, contentToken, logout } = useAuth();

  const [openForm, setOpenForm] = useState<OpenForm>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // メール変更。確認コードの入力は同じ枠の中で段階的に出す（別画面に飛ばさない）
  const [emailInput, setEmailInput] = useState(user?.email || '');
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');

  // パスワード変更
  const [currentPassword, setCurrentPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);

  const displayName = nickName || user?.username || 'ユーザー';
  const email = user?.email || 'メールアドレス未設定';
  // 未設定かどうかは resolveAvatarUrl の戻り値(URL)ではなく素の識別子で判断する。
  // 戻り値は未設定でも ui-avatars のURLになるので、URLの中身で判定すると壊れやすい。
  const hasAvatar = !!avatarUrl;
  const avatarSrc = withCfToken(resolveAvatarUrl(avatarUrl, displayName), contentToken);

  /** フォームを開く／閉じる。同時に開くのは1つだけ。開くたびに入力とエラーを捨てる */
  const toggleForm = (form: Exclude<OpenForm, null>) => {
    setError('');
    setNotice('');
    if (openForm === form) {
      setOpenForm(null);
      return;
    }
    setOpenForm(form);
    if (form === 'email') {
      setEmailInput(user?.email || '');
      setAwaitingCode(false);
      setVerifyCode('');
    } else {
      setCurrentPassword('');
      setNewPassword('');
      setShowCurrentPw(false);
      setShowNewPw(false);
    }
  };

  const handleSendEmailCode = async () => {
    if (!emailInput) { setError('メールアドレスを入力してください'); return; }
    if (emailInput === user?.email) { setError('現在と同じメールアドレスです'); return; }
    setLoading(true); setError('');
    try {
      await updateEmail(emailInput);
      setAwaitingCode(true);
    } catch (e: any) {
      setError(toJapaneseError(e));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!verifyCode) { setError('確認コードを入力してください'); return; }
    setLoading(true); setError('');
    try {
      await verifyEmailChange(verifyCode);
      setOpenForm(null);
      setAwaitingCode(false);
      setVerifyCode('');
      setNotice('メールアドレスを変更しました');
    } catch (e: any) {
      setError(toJapaneseError(e));
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    const failed = passwordRules.filter(r => !r.test(newPassword));
    if (!newPassword) { setError('新しいパスワードを入力してください'); return; }
    if (failed.length > 0) {
      setError(`パスワードの要件を満たしていません: ${failed.map(r => r.label).join('、')}`);
      return;
    }
    if (!currentPassword) { setError('現在のパスワードを入力してください'); return; }
    setLoading(true); setError('');
    try {
      await changePassword(currentPassword, newPassword);
      setOpenForm(null);
      setCurrentPassword('');
      setNewPassword('');
      setNotice('パスワードを変更しました');
    } catch (e: any) {
      setError(toJapaneseError(e));
    } finally {
      setLoading(false);
    }
  };

  /** 開いたフォームの枠。行の直下に差し込む（沈んだ地＋角丸で「行の続き」に見せる） */
  const formPanel: React.CSSProperties = {
    background: 'var(--dc-sunken)',
    border: '1px solid var(--dc-border)',
    borderRadius: 12,
    padding: '18px 20px',
    margin: '0 0 20px',
  };
  const formLabel: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--dc-text)', marginBottom: 6 };

  return (
    <div className="wc-warm min-h-screen flex flex-col" style={{ background: 'var(--dc-bg)' }}>
      <AppHeader />

      <main
        className="dc-page-main flex flex-col"
        style={{ flex: 1, padding: '44px 36px 24px', color: 'var(--dc-text)' }}
      >
        <h1 style={dcPageTitle}>アカウント設定</h1>
        <div style={dcPageLead}>プロフィールやログイン情報を管理できます</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 28, maxWidth: CONTENT_MAX_WIDTH }}>

          {notice && (
            <div
              role="status"
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--dc-success-surface)',
                border: '1px solid var(--dc-success)',
                borderRadius: 12,
                padding: '13px 18px',
                fontSize: 13.5, fontWeight: 700,
                color: 'var(--dc-success)',
              }}
            >
              <CheckCircle2 size={17} />
              {notice}
            </div>
          )}

          {/*
            ① プロフィール。
            🔴 デザイン 2a はここが2枚のカード（88px アバターのヒーロー ＋ 56px アイコンの
               プロフィール行）に分かれているが、どちらも行き先が /profile で、
               「名前とメール」「ニックネーム・アイコンを変更」という同じことを
               二度言っていた。縦にも 200px 近く使ってログイン情報が下に押し出される。
               1枚にまとめて、アバター・名前・メール・説明を1行に畳んでいる。
            🔴 行全体が /profile への1つのボタン。中に本物の <button> は置けない
               （ボタンの入れ子は不正なHTML）ので「編集」は <span>。カードの枠の
               ホバーと「編集」の地のホバーが別々に効くよう、span にも
               .dc-cta-outline を当てている。
          */}
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className={`settings-row-card ${focusRing}`}
            style={{
              ...dcCard,
              padding: '20px 26px',
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              textAlign: 'left',
              fontFamily: 'inherit',
              color: 'var(--dc-text)',
              cursor: 'pointer',
            }}
          >
            <SettingsAvatar src={hasAvatar ? avatarSrc : null} size={64} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: 'block', fontSize: 18, fontWeight: 800, lineHeight: 1.4,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {displayName}
              </span>
              <span
                style={{
                  display: 'block', fontSize: 13, color: 'var(--dc-text-muted)', marginTop: 2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {email}
              </span>
              <span style={{ display: 'block', fontSize: 12.5, color: 'var(--dc-text-subtle)', marginTop: 3 }}>
                ニックネーム・アイコンを変更できます
              </span>
            </span>
            <span
              className="dc-cta-outline"
              style={{ ...dcOutlineButton, fontSize: 13.5, padding: '9px 22px' }}
            >
              編集
            </span>
            <ChevronRight size={17} strokeWidth={2} style={dcChevron} />
          </button>

          {/* ② ログイン情報 */}
          <div style={{ ...dcCard, padding: '24px 26px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20 }}>
              <span style={dcIconBadge}><Lock size={24} strokeWidth={1.75} /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, paddingTop: 2 }}>ログイン情報</div>

                <LoginRow
                  label="メールアドレス"
                  value={email}
                  onEdit={() => toggleForm('email')}
                  active={openForm === 'email'}
                  divider
                >
                  {openForm === 'email' && (
                    <div style={formPanel}>
                      {!awaitingCode ? (
                        <>
                          <div style={formLabel}>新しいメールアドレス</div>
                          <input
                            type="email"
                            value={emailInput}
                            onChange={e => setEmailInput(e.target.value)}
                            style={{ ...dcInput, maxWidth: 420 }}
                            placeholder="user@example.com"
                          />
                          <div style={dcHint}>
                            変更すると新しいアドレスに確認コードが届きます。入力するまで切り替わりません。
                          </div>
                          {error && <div style={{ fontSize: 12.5, color: 'var(--dc-primary)', marginTop: 8 }}>{error}</div>}
                          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                            <button type="button" onClick={handleSendEmailCode} disabled={loading} className={`dc-cta-primary ${focusRing}`} style={dcPrimaryButton}>
                              {loading ? '送信中...' : '確認コードを送信'}
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div style={formLabel}>確認コード</div>
                          <div style={{ fontSize: 13, color: 'var(--dc-text-body)', marginBottom: 8 }}>
                            <strong style={{ fontWeight: 700 }}>{emailInput}</strong> に6桁のコードを送信しました。
                          </div>
                          <input
                            type="text"
                            value={verifyCode}
                            onChange={e => setVerifyCode(e.target.value)}
                            maxLength={6}
                            style={{ ...dcInput, maxWidth: 220, letterSpacing: '.3em' }}
                            placeholder="000000"
                          />
                          {error && <div style={{ fontSize: 12.5, color: 'var(--dc-primary)', marginTop: 8 }}>{error}</div>}
                          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                            <button type="button" onClick={handleVerifyEmail} disabled={loading} className={`dc-cta-primary ${focusRing}`} style={dcPrimaryButton}>
                              {loading ? '確認中...' : '確認する'}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setAwaitingCode(false); setVerifyCode(''); setError(''); }}
                              className={`dc-cta-outline ${focusRing}`}
                              style={dcOutlineButton}
                            >
                              アドレスを直す
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </LoginRow>

                <LoginRow
                  label="パスワード"
                  value="**********"
                  valueStyle={{ letterSpacing: '.12em' }}
                  onEdit={() => toggleForm('password')}
                  active={openForm === 'password'}
                  divider={false}
                >
                  {openForm === 'password' && (
                    <div style={{ ...formPanel, margin: '0 0 4px' }}>
                      <div style={formLabel}>現在のパスワード</div>
                      <div style={{ position: 'relative', maxWidth: 420 }}>
                        <input
                          type={showCurrentPw ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={e => setCurrentPassword(e.target.value)}
                          style={{ ...dcInput, paddingRight: 44 }}
                          placeholder="現在のパスワードを入力"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPw(v => !v)}
                          aria-label={showCurrentPw ? 'パスワードを隠す' : 'パスワードを表示'}
                          className={focusRing}
                          style={{
                            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                            color: 'var(--dc-text-subtle)', display: 'flex',
                          }}
                        >
                          {showCurrentPw ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>

                      <div style={{ ...formLabel, marginTop: 16 }}>新しいパスワード</div>
                      <div style={{ position: 'relative', maxWidth: 420 }}>
                        <input
                          type={showNewPw ? 'text' : 'password'}
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          style={{ ...dcInput, paddingRight: 44 }}
                          placeholder="新しいパスワードを入力"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPw(v => !v)}
                          aria-label={showNewPw ? 'パスワードを隠す' : 'パスワードを表示'}
                          className={focusRing}
                          style={{
                            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                            color: 'var(--dc-text-subtle)', display: 'flex',
                          }}
                        >
                          {showNewPw ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>

                      {/* 入力前から要件を出す。押してから怒られるより先に条件が見えている方がよい */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 10 }}>
                        {passwordRules.map(r => {
                          const ok = r.test(newPassword);
                          return (
                            <span
                              key={r.label}
                              style={{ fontSize: 12, color: ok ? 'var(--dc-success)' : 'var(--dc-text-subtle)' }}
                            >
                              {ok ? '✓' : '・'} {r.label}
                            </span>
                          );
                        })}
                      </div>

                      {error && <div style={{ fontSize: 12.5, color: 'var(--dc-primary)', marginTop: 10 }}>{error}</div>}

                      <div style={{ marginTop: 14 }}>
                        <button type="button" onClick={handleChangePassword} disabled={loading} className={`dc-cta-primary ${focusRing}`} style={dcPrimaryButton}>
                          {loading ? '変更中...' : 'パスワードを変更'}
                        </button>
                      </div>
                    </div>
                  )}
                </LoginRow>
              </div>
            </div>
          </div>

          {/* ③ ログアウト。破壊的操作なのでカードにせずテキストリンクで最後に置く */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 4px 0' }}>
            <button
              type="button"
              onClick={() => { logout(); navigate('/login', { replace: true }); }}
              className={`settings-logout ${focusRing}`}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', padding: 0,
                fontSize: 13, fontFamily: 'inherit', color: 'var(--dc-text-subtle)', cursor: 'pointer',
              }}
            >
              <LogOut size={15} strokeWidth={1.75} />
              アカウントからログアウトする
            </button>
          </div>
        </div>

        <AppFooter />
      </main>
    </div>
  );
}

export default AccountSettingsPage;
