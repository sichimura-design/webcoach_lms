import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { ProfileFormData } from '../types/profile';
import bffClient from '../services/bffClient';
import { fetchUserProfile } from '../services/mypageApi';
import { useAuth } from '../contexts/AuthContext';
import { AppFooter, AppHeader } from './shared';
import { AvatarPicker, resolveAvatarUrl, withCfToken } from './profile/AvatarPicker';
import SettingsAvatar from './profile/SettingsAvatar';
import { getUserMessage } from '../utils/errorMessage';
import {
  CONTENT_MAX_WIDTH,
  dcCard,
  dcGhostButton,
  dcHint,
  dcInput,
  dcOutlineButton,
  dcPageLead,
  dcPageTitle,
  dcPrimaryButton,
  dcRowLabel,
  focusRing,
} from './profile/settingsStyles';

/**
 * プロフィール設定（/profile）。
 * claude.ai/design『学習画面デザイン案.dc.html』2b 準拠。
 *
 * 【レイアウト方式】
 * 🔴 サイドバーは AppHeader.tsx（既存モック）をそのまま使う。450px 中央寄せの白カード＋
 *    放射グラデの玉だった旧デザインは廃止し、アカウント設定（2a）・マイページ（5a）と
 *    同じ .wc-warm + dc-page-main に載せ替えた。
 *
 * 【構成】アイコン / ニックネーム の2行だけ。
 *
 * 🔴 アイコンは管理画面（/admin/avatars）が登録したプリセットから選ぶだけ。
 *    受講生が任意画像を自分のアイコンにアップロードする経路は無い（実BFFにAPIが無く、
 *    フロントのモックだけで完結していたため撤去した。任意画像を扱うなら、S3キーを
 *    サーバ側で決める専用エンドポイントをBFFに立てるところからになる）。
 * 🔴 メールアドレスはこの画面に置かない。表示だけの行を置いていた時期があるが、
 *    編集できない値を編集画面に並べても意味が無く、変更（Cognito の確認コード往復）は
 *    アカウント設定の「ログイン情報」が1箇所で持っている。
 * 🔴 「理想のキャリア」「今日のスモールステップ」の入力欄は 2b に無いので外した。
 *    ただし formData には読み込んだまま保持し、保存時にもそのまま送っている
 *    （欄が無いことを理由に既存値を null で潰さないため）。today_small_step は
 *    マイページのタスクに使われている（services/mypageApi.ts）。
 */

function ProfilePage() {
  const navigate = useNavigate();
  const { user, contentToken, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<ProfileFormData>({
    nickName: '',
    idealCareer: '',
    todaySmallStep: '',
    avatar_url: '',
    avatar_id: '',
  });

  useEffect(() => {
    if (user?.userid) {
      loadProfileData(user.userid);
    } else {
      navigate('/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const loadProfileData = async (currentUserId: number) => {
    try {
      setIsLoading(true);
      setError(null);
      const profileData = await fetchUserProfile(currentUserId);
      setFormData({
        nickName: profileData.nick_name || '',
        idealCareer: profileData.ideal_career || '',
        todaySmallStep: profileData.today_small_step || '',
        avatar_url: profileData.avatar_url || '',
        avatar_id: profileData.avatar_id != null ? String(profileData.avatar_id) : '',
      });
    } catch (err: any) {
      console.error('Failed to load profile:', err);
      setError(getUserMessage(err, 'プロフィールの取得に失敗しました'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.userid) {
      setError('ユーザーIDが取得できていません');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      setToastMessage(null);
      await bffClient.updateUserProfile(user.userid, {
        nick_name: formData.nickName || null,
        // 🔴 この2つは 2b に入力欄が無いが、読み込んだ値をそのまま送り返している。
        //    省略すると保存のたびに既存値が消える。
        ideal_career: formData.idealCareer || null,
        today_small_step: formData.todaySmallStep || null,
        // avatar_url は実APIに列が無く無視されるだけなので送らない（avatar_id のみが実データ）
        avatar_id: formData.avatar_id || null,
      });
      setToastMessage('プロフィールを保存しました！');
      await Promise.all([loadProfileData(user.userid), refreshProfile()]);
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      setError(getUserMessage(err, 'プロフィールの保存に失敗しました'));
    } finally {
      setSaving(false);
    }
  };

  /*
   * 🔴 アイコン画像のアップロード（handlePickFile / bffClient.uploadProfileAvatar）は
   *    撤去した。任意の画像を受け取る口を持たないため。
   *    アイコンはプリセット（AvatarPicker）から選ぶ1経路だけ。
   */

  // avatar_url が実URLならそのまま、なければ avatar_id / avatar_url から解決。
  // 🔴 data: の分岐はアップロード時代の名残なので残してある。古いプロフィールに
  //    data URL が入ったままのユーザーがいても、画像が消えないようにするため。
  const avatarIdentifier = formData.avatar_url?.startsWith('http') || formData.avatar_url?.startsWith('data:')
    ? formData.avatar_url
    : formData.avatar_id || formData.avatar_url;
  const hasAvatar = !!avatarIdentifier;
  const avatarSrc = withCfToken(resolveAvatarUrl(avatarIdentifier, formData.nickName), contentToken);

  // avatar_id が数値文字列なら number に変換、dicebear識別子などはnullとして扱う
  const selectedAvatarId = formData.avatar_id && /^\d+$/.test(formData.avatar_id)
    ? Number(formData.avatar_id)
    : null;

  if (isLoading) {
    return (
      <div className="wc-warm min-h-screen flex items-center justify-center" style={{ background: 'var(--dc-bg)' }}>
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4"
            style={{ borderColor: 'var(--dc-primary)' }}
          />
          <p style={{ color: 'var(--dc-text-muted)' }}>読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="wc-warm min-h-screen flex flex-col" style={{ background: 'var(--dc-bg)' }}>
      {toastMessage && (
        <div
          role="status"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50"
          style={{
            background: 'var(--dc-success)', color: '#fff',
            padding: '12px 24px', borderRadius: 12,
            fontSize: 13.5, fontWeight: 700, boxShadow: 'var(--dc-shadow-float)',
          }}
        >
          {toastMessage}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50"
          style={{
            background: 'var(--dc-primary)', color: '#fff',
            padding: '12px 24px', borderRadius: 12,
            fontSize: 13.5, fontWeight: 700, boxShadow: 'var(--dc-shadow-float)',
          }}
        >
          {error}
        </div>
      )}

      <AppHeader userName={formData.nickName} avatarUrl={avatarSrc} />

      <main
        className="dc-page-main flex flex-col"
        style={{ flex: 1, padding: '44px 36px 24px', color: 'var(--dc-text)' }}
      >
        <button
          type="button"
          onClick={() => navigate('/account-settings')}
          className={focusRing}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 2, alignSelf: 'flex-start',
            background: 'none', border: 'none', padding: 0, marginBottom: 10,
            fontSize: 13, fontFamily: 'inherit', color: 'var(--dc-text-muted)', cursor: 'pointer',
          }}
        >
          <ChevronLeft size={15} style={{ color: 'var(--dc-primary)' }} />
          <span style={{ color: 'var(--dc-primary)', fontWeight: 500 }}>アカウント設定</span>
          <span style={{ marginLeft: 4 }}>に戻る</span>
        </button>

        <h1 style={dcPageTitle}>プロフィール</h1>
        <div style={dcPageLead}>ニックネームとアイコンを変更できます</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 28, maxWidth: CONTENT_MAX_WIDTH }}>
          <div style={{ ...dcCard, padding: '28px 30px' }}>

            {/* アイコン */}
            <div
              className="settings-field"
              style={{
                display: 'flex', alignItems: 'center', gap: 26,
                paddingBottom: 26, borderBottom: '1px solid var(--dc-border)',
              }}
            >
              <span className="settings-field-label" style={{ ...dcRowLabel, width: 160 }}>アイコン</span>
              {/* 2a のカードと同じ作り（ピンク円の中に一段小さいアバター）で揃える */}
              <SettingsAvatar
                src={hasAvatar ? avatarSrc : null}
                alt={formData.nickName || 'プロフィール画像'}
                size={96}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
                {/* 🔴 唯一の導線。任意画像のアップロード（デザイン 2b の
                       「画像をアップロード」）は撤去したので、テキストリンクではなく
                       ボタンで出す。 */}
                <AvatarPicker
                  selectedAvatarId={selectedAvatarId}
                  onSelect={(avatarId, url) =>
                    setFormData(prev => ({ ...prev, avatar_id: String(avatarId), avatar_url: url }))
                  }
                  triggerLabel="アイコンを選ぶ"
                  triggerClassName={`dc-cta-outline ${focusRing}`}
                  triggerStyle={{ ...dcOutlineButton, fontSize: 13.5, padding: '9px 22px' }}
                />
                <span style={{ ...dcHint, marginTop: 0 }}>
                  用意されたアイコンから選べます
                </span>
              </div>
            </div>

            {/*
              ニックネーム。この画面の最後の行なので下線は引かない。
              🔴 メールアドレスの行（表示のみ）はここに置いていた時期があるが外した。
                 編集できない値を編集画面に並べても意味が無く、変更はアカウント設定の
                 「ログイン情報」が持っている。
            */}
            <div
              className="settings-field"
              style={{ display: 'flex', alignItems: 'center', gap: 26, paddingTop: 26 }}
            >
              <label className="settings-field-label" htmlFor="profile-nickname" style={{ ...dcRowLabel, width: 160 }}>
                ニックネーム
              </label>
              <div style={{ flex: 1, maxWidth: 420, minWidth: 0 }}>
                <input
                  id="profile-nickname"
                  type="text"
                  value={formData.nickName}
                  onChange={(e) => setFormData(prev => ({ ...prev, nickName: e.target.value }))}
                  maxLength={20}
                  style={dcInput}
                  placeholder="名前を入力"
                />
                <div style={dcHint}>コーチングやコメントで表示される名前です（20文字まで）</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <button
              type="button"
              onClick={() => navigate('/account-settings')}
              className={focusRing}
              style={dcGhostButton}
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={`dc-cta-primary ${focusRing}`}
              style={dcPrimaryButton}
            >
              {saving ? '保存中...' : '保存する'}
            </button>
          </div>
        </div>

        <AppFooter />
      </main>
    </div>
  );
}

export default ProfilePage;
