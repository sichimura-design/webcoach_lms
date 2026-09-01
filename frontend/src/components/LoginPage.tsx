import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { MOCKS_ENABLED } from '../mocks/config';
import { AppFooter } from './shared';

function MailIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/**
 * 入力欄の共通クラス。
 * 🔴 以前は border 1px の淡色 + 半透明の背景（rgba(255,255,255,0.72)）だったため、
 *    枠が細くて頼りない上に、カード背後のグラデーションが透けて
 *    枠の上辺と下辺で濃さが違って見えていた（レビュー指摘）。
 *    背景を不透明の白にして透けを止め、枠を 1.5px の均一色にしている。
 */
const INPUT_BASE =
  'w-full h-12 rounded-xl text-[15px] border-[1.5px] border-[#d6cecb] bg-white text-[#3c3333] placeholder:text-[#b6aeac] outline-none transition-all duration-150 hover:border-[#c6bcb8] focus:border-[rgba(214,9,52,0.7)] focus:shadow-[0_0_0_4px_rgba(214,9,52,0.09)]';

function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login, submitNewPassword, needsNewPassword, user } = useAuth();

  // モック時は自動ログイン済みなので、ログイン画面に来たら /mypage へ送る。
  // ただし userid が未解決（0）のときはリダイレクトしない
  // （SW取りこぼし等で userid=0 になった場合に /mypage⇄/login の無限ループを防ぐ）。
  useEffect(() => {
    if (MOCKS_ENABLED && user?.userid) {
      navigate('/mypage', { replace: true });
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await login(username, password);
      if (result === 'SUCCESS') {
        navigate('/mypage');
      }
      // NEW_PASSWORD_REQUIRED の場合は AuthContext が needsNewPassword を true にする
    } catch (err: any) {
      const code = err?.code || err?.name || '';
      if (code === 'NotAuthorizedException') {
        if (err.message?.includes('Temporary password has expired')) {
          setError('仮パスワードの有効期限が切れています。管理者にお問い合わせください。');
        } else {
          setError('メールアドレスまたはパスワードが正しくありません');
        }
      } else if (code === 'UserNotFoundException') {
        setError('ユーザーが見つかりません');
      } else if (code === 'UserNotConfirmedException') {
        setError('メールアドレスの確認が完了していません');
      } else {
        setError(err.message || 'ログインに失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    if (newPassword.length < 8) {
      setError('パスワードは8文字以上で入力してください');
      return;
    }

    setLoading(true);

    try {
      await submitNewPassword(newPassword);
      navigate('/mypage');
    } catch (err: any) {
      const code = err?.code || err?.name || '';
      if (code === 'InvalidPasswordException') {
        setError('パスワードは大文字・小文字・数字を含む8文字以上にしてください');
      } else {
        setError(err.message || 'パスワードの変更に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden pt-6 px-[18px] pb-16 sm:pt-8 sm:px-6"
      style={{
        // 下地のグラデーションは、上の光の帯を薄くしたぶん少し強めて「引き」でも色の流れが分かるようにする
        backgroundImage:
          'radial-gradient(ellipse 52% 44% at 2% 0%, rgba(151,132,120,0.16) 0%, rgba(172,151,138,0.08) 40%, rgba(255,255,255,0) 76%), linear-gradient(118deg, #fffefd 0%, #fcf8f4 40%, #f6ece3 100%)',
        fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
        color: '#3c3333',
      }}
    >
      {/*
        斜光の背景。
        🔴 以前は光の帯が細かく・中央のスポットライトが濃すぎて、
           せっかくのグラデーションが白飛びして見えなかった（レビュー指摘）。
           帯のピッチを倍以上に広げて「引き」の絵にし、中央の白も薄くして、
           下地のグラデーション（左上のくすみ → 右下のベージュ）が読めるようにしている。
      */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute"
          style={{
            inset: '-40%',
            background:
              'repeating-linear-gradient(77deg, transparent 0 20%, rgba(173,151,137,0.09) 24%, rgba(255,255,255,0.5) 30%, rgba(185,163,149,0.11) 38%, transparent 48%, transparent 72%)',
            filter: 'blur(46px)',
            transform: 'rotate(-4deg) scale(1.2)',
            opacity: 0.8,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 62% 58% at 50% 46%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.26) 40%, transparent 78%)',
          }}
        />
        <div
          className="absolute"
          style={{
            top: '-35%',
            right: '4%',
            width: '30vw',
            minWidth: '260px',
            height: '170%',
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), rgba(162,142,130,0.05), transparent)',
            filter: 'blur(60px)',
            transform: 'rotate(-17deg)',
            opacity: 0.85,
          }}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center relative">
        <div
          className="w-full max-w-[470px] rounded-[20px] sm:rounded-[24px] backdrop-blur-[18px] px-6 py-7 sm:px-11 sm:py-8"
          style={{
            border: '1px solid rgba(255,255,255,0.86)',
            background: 'rgba(255,255,255,0.84)',
            boxShadow: '0 28px 80px rgba(91,55,54,0.1), 0 5px 20px rgba(91,55,54,0.05)',
          }}
        >
          {/*
            ブランド表記。
            🔴 以前は logo_WEBCOACH.png（256x73）を56px高まで拡大＋下部タグラインをCSSクロップ
               していたため、高DPIディスプレイで明確に粗く見えていた（レビュー指摘）。
               同じ素材の高解像度版が無いので、サイドバー（AppHeader）と同じ
               テキストのワードマークに統一した。どの倍率でも輪郭が崩れない。
          */}
          <div className="flex flex-col items-center" style={{ marginBottom: 18 }}>
            <span
              className="text-[26px] sm:text-[30px] leading-none"
              style={{
                fontWeight: 800,
                letterSpacing: '0.055em',
                color: '#D60934',
                fontFamily: '"Noto Sans JP", sans-serif',
              }}
            >
              WEBCOACH
            </span>
            <span
              className="text-[10px] sm:text-[11px]"
              style={{ marginTop: 7, fontWeight: 700, letterSpacing: '0.08em', color: '#8e817e' }}
            >
              キャリアを、もっと自由に。
            </span>
          </div>

          <h1
            className="text-center text-[21px] sm:text-[24px] leading-[1.4] tracking-[0.02em]"
            style={{
              margin: 0,
              fontFamily: '"Noto Sans JP", sans-serif',
              fontWeight: 600,
              color: '#3c3333',
            }}
          >
            学習システム
          </h1>

          {/* 「未来の自分を、いま作る。」のテキストは削除。区切りの赤いバーのみ残す */}
          <div style={{ margin: '8px 0 58px', textAlign: 'center' }}>
            <div style={{ width: 42, height: 2, margin: '10px auto 0', background: '#D60934', borderRadius: 999 }} />
          </div>

          {needsNewPassword ? (
            /* New Password Form */
            <form onSubmit={handleNewPassword} className="space-y-6">
              <div className="px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                初回ログインのためパスワードの変更が必要です
              </div>

              <div style={{ marginBottom: 14 }}>
                <div className="flex items-center justify-between gap-4" style={{ marginBottom: 6 }}>
                  <label className="text-sm font-bold" style={{ color: '#3c3333' }}>
                    新しいパスワード
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    autoFocus
                    required
                    placeholder="8文字以上（大文字・小文字・数字を含む）"
                    className={`${INPUT_BASE} px-[17px] pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 p-0 bg-transparent border-0 cursor-pointer text-brand-muted/50 hover:text-brand-muted transition-colors flex items-center"
                    tabIndex={-1}
                  >
                    <EyeIcon open={showNewPassword} />
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div className="flex items-center justify-between gap-4" style={{ marginBottom: 6 }}>
                  <label className="text-sm font-bold" style={{ color: '#3c3333' }}>
                    パスワード確認
                  </label>
                </div>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                    placeholder="もう一度入力してください"
                    className={`${INPUT_BASE} px-[17px] pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 p-0 bg-transparent border-0 cursor-pointer text-brand-muted/50 hover:text-brand-muted transition-colors flex items-center"
                    tabIndex={-1}
                  >
                    <EyeIcon open={showConfirmPassword} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600" style={{ marginBottom: 14 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[52px] rounded-xl border-0 outline-none text-white text-base font-bold tracking-[0.04em] cursor-pointer transition-all duration-150 bg-[linear-gradient(135deg,#E5103C,#D60934_58%,#B50829)] shadow-[0_14px_26px_rgba(214,9,52,0.2),inset_0_1px_0_rgba(255,255,255,0.24)] hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_18px_30px_rgba(214,9,52,0.28),inset_0_1px_0_rgba(255,255,255,0.24)] active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ marginTop: 4 }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    変更中...
                  </span>
                ) : (
                  'パスワードを変更してログイン'
                )}
              </button>
            </form>
          ) : (
            /* Login Form */
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 20 }}>
                <div className="flex items-center justify-between gap-4" style={{ marginBottom: 6 }}>
                  <label className="text-sm font-bold" style={{ color: '#3c3333' }}>
                    メールアドレス
                  </label>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-4 text-brand-muted/50 pointer-events-none flex items-center">
                    <MailIcon />
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    autoFocus
                    required
                    placeholder="user@example.com"
                    className={`${INPUT_BASE} pl-11 pr-[17px]`}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 44 }}>
                <div className="flex items-center justify-between gap-4" style={{ marginBottom: 6 }}>
                  <label className="text-sm font-bold" style={{ color: '#3c3333' }}>
                    パスワード
                  </label>
                  <span
                    onClick={() => navigate('/password-reset')}
                    className="text-xs cursor-pointer"
                    style={{ color: '#D60934' }}
                  >
                    パスワードお忘れですか？
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-4 text-brand-muted/50 pointer-events-none flex items-center">
                    <LockIcon />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    placeholder="パスワードを入力"
                    className={`${INPUT_BASE} pl-11 pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-3 p-0 bg-transparent border-0 cursor-pointer text-brand-muted/50 hover:text-brand-muted transition-colors flex items-center"
                    tabIndex={-1}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600" style={{ marginBottom: 14 }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[52px] rounded-xl border-0 outline-none text-white text-base font-bold tracking-[0.04em] cursor-pointer transition-all duration-150 bg-[linear-gradient(135deg,#E5103C,#D60934_58%,#B50829)] shadow-[0_14px_26px_rgba(214,9,52,0.2),inset_0_1px_0_rgba(255,255,255,0.24)] hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_18px_30px_rgba(214,9,52,0.28),inset_0_1px_0_rgba(255,255,255,0.24)] active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ marginTop: 18 }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ログイン中...
                  </span>
                ) : (
                  'ログイン　›'
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ヒーローの上に絶対配置で重ねるので位置だけ上書きする（色・字は共通のまま） */}
      <AppFooter
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '19px 24px',
          marginTop: 0,
        }}
      />
    </div>
  );
}

export default LoginPage;
