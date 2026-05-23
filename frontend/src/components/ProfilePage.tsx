import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { ProfileFormData } from '../types/profile';
import bffClient from '../services/bffClient';
import { fetchUserProfile } from '../services/mypageApi';
import { useAuth } from '../contexts/AuthContext';
import { AppHeader } from './shared';
import { AvatarPicker, resolveAvatarUrl, withCfToken } from './profile/AvatarPicker';

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
      setError(err.message || 'プロフィールの取得に失敗しました');
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
        ideal_career: formData.idealCareer || null,
        today_small_step: formData.todaySmallStep || null,
        avatar_url: formData.avatar_url || null,
        avatar_id: formData.avatar_id || null,
      });
      setToastMessage('プロフィールを保存しました！');
      await Promise.all([loadProfileData(user.userid), refreshProfile()]);
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      setError(err.message || 'プロフィールの保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  // avatar_url が実URLなら直接使用、なければ avatar_id / avatar_url から解決
  const avatarIdentifier = formData.avatar_url?.startsWith('http')
    ? formData.avatar_url
    : formData.avatar_id || formData.avatar_url;
  const avatarSrc = withCfToken(resolveAvatarUrl(avatarIdentifier, formData.nickName), contentToken);

  // avatar_id が数値文字列なら number に変換、dicebear識別子などはnullとして扱う
  const selectedAvatarId = formData.avatar_id && /^\d+$/.test(formData.avatar_id)
    ? Number(formData.avatar_id)
    : null;

  const inputClass = 'w-full px-4 py-3 bg-brand-bg border border-[#CEC3BB] rounded-xl text-sm text-brand-muted focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent';
  const labelClass = 'block text-[13px] font-bold text-brand-muted mb-2';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4" />
          <p className="text-brand-muted">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg z-50">
          {toastMessage}
        </div>
      )}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg z-50">
          {error}
        </div>
      )}

      <AppHeader userName={formData.nickName} avatarUrl={avatarSrc} />

      {/* Background gradient blobs */}
      <div className="relative flex-1">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute w-[1152px] h-[1152px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(225,112,121,0.3) 0%, transparent 70%)', top: '-200px', left: '-300px' }}
          />
          <div
            className="absolute w-[1152px] h-[1152px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(253,234,226,0.5) 0%, transparent 70%)', top: '-100px', right: '-400px' }}
          />
          <div
            className="absolute w-[1152px] h-[1152px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(242,147,103,0.3) 0%, transparent 70%)', bottom: '-300px', left: '50%' }}
          />
        </div>

        {/* Centered card */}
        <main className="relative flex justify-center px-4 py-12">
          <div className="w-full max-w-[450px] bg-white rounded-3xl shadow-sm px-6 sm:px-10 pt-8 pb-10">

            {/* Back button + title */}
            <div className="relative flex items-center justify-center mb-8">
              <button
                onClick={() => navigate('/mypage')}
                className="absolute left-0 w-9 h-9 rounded-full bg-brand-bg hover:bg-[#F0EAE6] flex items-center justify-center transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-brand-muted" />
              </button>
              <h2
                className="text-xl font-bold text-brand-text"
              >
                プロフィール編集
              </h2>
            </div>

            {/* Avatar */}
            <div className="flex items-center gap-4 mb-7">
              <div className="w-[72px] h-[72px] rounded-full overflow-hidden bg-[#F0EAE6] flex-shrink-0">
                <img src={avatarSrc} alt={formData.nickName || 'Profile'} className="w-full h-full object-cover bg-[#FAF8F4]" />
              </div>
              <AvatarPicker
                selectedAvatarId={selectedAvatarId}
                onSelect={(avatarId, url) => setFormData(prev => ({ ...prev, avatar_id: String(avatarId), avatar_url: url }))}
              />
            </div>

            {/* お名前 */}
            <div className="mb-5">
              <label className={labelClass}>お名前</label>
              <input
                type="text"
                value={formData.nickName}
                onChange={(e) => setFormData(prev => ({ ...prev, nickName: e.target.value }))}
                className={inputClass}
                placeholder="名前を入力"
              />
            </div>

            {/* 理想のキャリア */}
            <div className="mb-5">
              <label className={labelClass}>理想のキャリア</label>
              <textarea
                value={formData.idealCareer}
                onChange={(e) => setFormData(prev => ({ ...prev, idealCareer: e.target.value }))}
                rows={3}
                className={inputClass + ' resize-none'}
                placeholder="理想のキャリアを入力"
              />
            </div>

            {/* 今日のスモールステップ */}
            <div className="mb-8">
              <label className={labelClass}>今日のスモールステップ</label>
              <textarea
                value={formData.todaySmallStep}
                onChange={(e) => setFormData(prev => ({ ...prev, todaySmallStep: e.target.value }))}
                rows={3}
                className={inputClass + ' resize-none'}
                placeholder="今日の小さな一歩を入力"
              />
            </div>

            {/* 変更するボタン */}
            <Button
              onClick={handleSave}
              disabled={saving}
              variant="brand"
              className="w-full py-3.5 text-base rounded-xl"
            >
              {saving ? '保存中...' : '変更する'}
            </Button>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-brand-footer h-10 flex items-center justify-center">
        <span className="text-[11.4px] font-bold text-white" style={{ letterSpacing: '0.6px' }}>
          2024 &copy; WEBCOACH
        </span>
      </footer>
    </div>
  );
}

export default ProfilePage;
