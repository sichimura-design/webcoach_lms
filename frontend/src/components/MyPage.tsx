import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit2, PlayCircle, FileText, HelpCircle, Mail, ChevronRight, Heart, Flag, Bookmark } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';
import { AppHeader } from './shared';
import { CourseImage } from './shared/CourseImage';
import { useMypageData } from '../hooks/useMypageData';
import { resolveAvatarUrl, withCfToken } from './profile/AvatarPicker';

function MyPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, contentToken } = useAuth();

  const {
    userProfile,
    resumableCourse,
    activeCourses,
    loading: isLoading,
    error,
  } = useMypageData(user?.userid);

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
          <p className="text-brand-muted">読み込み中...</p>
        </div>
      </div>
    );
  }

  // Moodle account not linked
  if (!user?.userid) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-brand-muted font-bold mb-2">セッションが切れました</p>
          <p className="text-sm text-brand-muted mb-4">
            再度ログインしてください。
          </p>
          <Button onClick={() => navigate('/login')} variant="brand" className="mt-2 rounded-xl px-6 py-2">
            ログイン画面へ
          </Button>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !userProfile) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-brand-muted">{error || 'データの読み込みに失敗しました'}</p>
          <Button
            onClick={() => window.location.reload()}
            variant="brand"
            className="mt-4 rounded-xl px-6 py-2"
          >
            再読み込み
          </Button>
        </div>
      </div>
    );
  }

  // 最終アクセス時間をフォーマット（分・時間・日のいずれか1つで表示）
  const formatLastAccess = (date?: Date | string) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (minutes < 1) return '1分前';
    if (minutes < 60) return `${minutes}分前`;
    if (hours < 24) return `${hours}時間前`;
    return `${days}日前`;
  };

  const avatarName = userProfile.nick_name || '未設定';
  const avatarIdentifier = userProfile.avatar_url?.startsWith('http')
    ? userProfile.avatar_url
    : userProfile.avatar_id || userProfile.avatar_url;
  const avatarSrc = withCfToken(resolveAvatarUrl(avatarIdentifier, avatarName), contentToken);

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <AppHeader
        userName={avatarName}
        avatarUrl={avatarSrc}
      />

      {/* Background with gradient circles */}
      <div className="relative flex-1">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute w-[600px] h-[600px] sm:w-[900px] sm:h-[900px] lg:w-[1152px] lg:h-[1152px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(225,112,121,0.3) 0%, transparent 70%)', top: '-200px', left: '-300px' }}
          />
          <div
            className="absolute w-[600px] h-[600px] sm:w-[900px] sm:h-[900px] lg:w-[1152px] lg:h-[1152px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(253,234,226,0.5) 0%, transparent 70%)', top: '-100px', right: '-400px' }}
          />
          <div
            className="absolute w-[600px] h-[600px] sm:w-[900px] sm:h-[900px] lg:w-[1152px] lg:h-[1152px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(242,147,103,0.3) 0%, transparent 70%)', bottom: '-300px', left: '50%' }}
          />
        </div>

        {/* Main Content */}
        <main className="relative max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
          {/* Profile Card - Full Width */}
          <div className="bg-white rounded-[32px] shadow-sm p-6 sm:p-8 mb-6 relative overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-[#FFF5F0] opacity-60" />
            <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-[#E8F5E9] opacity-60" />

            <div className="relative flex gap-5 sm:gap-6">
              {/* Left: Avatar + Name */}
              <div className="flex flex-col items-center gap-2 flex-shrink-0 w-[80px] sm:w-[96px]">
                <div className="w-[72px] sm:w-[88px] h-[72px] sm:h-[88px] rounded-full overflow-hidden bg-[#F0EAE6]">
                  <img
                    src={avatarSrc}
                    alt={avatarName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-sm font-bold text-brand-text text-center leading-tight">
                  {userProfile.nick_name || '未設定'}
                </p>
              </div>

              {/* Right: Info cards */}
              <div className="flex-1 flex flex-col gap-3">
                {/* 理想のキャリア */}
                <div className="rounded-2xl px-4 py-3" style={{ background: '#FFF5EA' }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-[18px] h-[18px] rounded bg-[#FA9262] flex items-center justify-center flex-shrink-0">
                      <Flag className="w-2.5 h-2.5 text-white" />
                    </div>
                    <span className="text-xs font-bold text-[#FA9262]">理想のキャリア</span>
                  </div>
                  <p className="text-sm font-bold text-brand-text">
                    {userProfile.ideal_career || '未設定'}
                  </p>
                </div>

                {/* 今日のスモールステップ */}
                <div className="bg-white border border-[#F0EAE6] rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="w-[18px] h-[18px] rounded-full bg-brand flex items-center justify-center flex-shrink-0">
                      <Bookmark className="w-2.5 h-2.5 text-white" />
                    </div>
                    <span className="text-xs font-bold text-brand-muted">今日のスモールステップ</span>
                  </div>
                  <div className="pl-3 border-l-2 border-[#FA9262]">
                    <p className="text-sm text-brand-text">
                      {userProfile.today_small_step || '未設定'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Edit Profile Button - bottom right */}
            <div className="relative flex justify-end mt-4">
              <button
                onClick={() => navigate('/profile')}
                className="flex items-center gap-1.5 text-xs text-brand-muted hover:text-brand transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                プロフィール編集
              </button>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Resume Course Card */}
              {resumableCourse && (
                <div className="bg-white rounded-[32px] shadow-sm overflow-hidden">
                  <div className="flex flex-col sm:flex-row">
                    {/* Left Content */}
                    <div className="flex-1 p-6 sm:p-8">
                      <div className="inline-block px-4 py-1.5 bg-[#FFEAE1] text-brand text-sm font-semibold rounded-full mb-4">
                        前回のつづき
                      </div>

                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-[3px] h-7 bg-brand-text rounded-full mt-0.5 flex-shrink-0"></div>
                        <h3 className="text-2xl font-semibold text-brand-text">
                          {resumableCourse.title}
                        </h3>
                      </div>

                      {resumableCourse.currentLesson && (
                        <div className="inline-block px-3 py-1.5 bg-[#FFF5D6] rounded-lg mb-5">
                          <span className="text-sm font-medium text-brand-muted">
                            {resumableCourse.currentLesson}
                          </span>
                        </div>
                      )}

                      <div className="mb-5">
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="text-xs text-brand-muted">進捗率</span>
                          <span className="text-base font-semibold text-brand">{resumableCourse.progress || 0}%</span>
                        </div>
                        <div className="h-2 bg-[#EFEFEF] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${resumableCourse.progress || 0}%`,
                              background: 'linear-gradient(90deg, #FA9161, #E86D78)',
                            }}
                          />
                        </div>
                      </div>

                      <Button
                        onClick={() => navigate(`/course/${resumableCourse.id}/curriculum`)}
                        variant="brand"
                        className="w-full rounded-xl px-6 py-3 flex items-center justify-center gap-2"
                      >
                        学習を再開する
                        <PlayCircle className="w-[18px] h-[18px]" />
                      </Button>
                    </div>

                    {/* Right: Course Icon/Image */}
                    <div className="hidden sm:block w-[240px] flex-shrink-0 m-4 rounded-[28px] overflow-hidden">
                      <CourseImage
                        imageUrl={resumableCourse.thumbnailUrl}
                        alt={resumableCourse.title}
                        fallbackText={resumableCourse.title}
                        fallbackColor="#F3A7A7"
                        className="w-full h-full"
                        style={{ height: '100%', minHeight: '140px' }}
                        hideFallbackText
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Active Courses Section */}
              {activeCourses.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-brand-muted">
                      学習中のコース
                    </h3>
                    <button
                      onClick={() => navigate('/learning-courses')}
                      className="text-xs font-medium text-brand-muted bg-white hover:bg-gray-50 flex items-center gap-1 border border-gray-200 rounded-full px-4 py-1.5 shadow-sm transition-colors"
                    >
                      すべて見る
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activeCourses.slice(0, 4).map((course) => (
                      <div
                        key={course.id}
                        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => navigate(`/course/${course.id}/curriculum`)}
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
                            <CourseImage
                              imageUrl={course.thumbnailUrl}
                              alt={course.title}
                              fallbackColor="#FFF5D6"
                              className="w-full h-full"
                              style={{ height: '40px' }}
                              hideFallbackText
                            />
                          </div>
                          <div className="flex-1 min-w-0 flex items-start justify-between gap-2">
                            <div />
                            <span className="text-[10px] text-brand-muted bg-[#FAFAFA] rounded-full px-2.5 py-1 flex-shrink-0 border border-gray-100">
                              {formatLastAccess(course.lastAccessDate)}
                            </span>
                          </div>
                        </div>

                        <h4 className="text-sm font-bold text-brand-text mb-3 line-clamp-2">
                          {course.title}
                        </h4>

                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 bg-[#EFEFEF] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#FA9161] rounded-full transition-all"
                              style={{ width: `${course.progress || 0}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-[#FA9161] min-w-[28px] text-right">{course.progress || 0}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Right Sidebar */}
            <aside>
              {/* Support Menu */}
              <div className="bg-white rounded-3xl shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Heart className="w-5 h-5 text-brand" />
                  <h3 className="text-base font-bold text-brand-muted">
                    サポートメニュー
                  </h3>
                </div>

                <div className="space-y-1">
                  <a href="https://slime-gruyere-92d.notion.site/WEBCOACH-6-0-7a07e36455e848c4b4d262ef3a1c1cd4" target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm sm:text-base text-brand-muted hover:bg-brand-bg rounded-xl transition-colors">
                    <FileText className="w-[18px] h-[18px] text-brand-muted" />
                    <span>利用マニュアル</span>
                  </a>
                  <a href="https://slime-gruyere-92d.notion.site/1fddd266074f809e9f0cfdbdd8e60ffd" target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm sm:text-base text-brand-muted hover:bg-brand-bg rounded-xl transition-colors">
                    <HelpCircle className="w-[18px] h-[18px] text-brand-muted" />
                    <span>よくある質問</span>
                  </a>
                  <a href="https://channel.io/ja" target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm sm:text-base text-brand-muted hover:bg-brand-bg rounded-xl transition-colors">
                    <Mail className="w-[18px] h-[18px] text-brand-muted" />
                    <span>運営へのお問い合わせ</span>
                  </a>
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-brand-footer h-10 flex items-center justify-center">
        <span className="text-[11.4px] font-bold text-white">
          2024 &copy; WEBCOACH
        </span>
      </footer>
    </div>
  );
}

export default MyPage;
