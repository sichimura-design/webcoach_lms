import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit2, PlayCircle, ChevronRight, Flag, Bookmark, Play } from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';
import { AppHeader } from './shared';
import { CourseImage } from './shared/CourseImage';
import { useMypageData } from '../hooks/useMypageData';
import { resolveAvatarUrl, withCfToken } from './profile/AvatarPicker';
import { CoachingGoals } from './mypage/CoachingGoals';

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
      <div className="min-h-screen bg-dash-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-dash-primary mx-auto mb-4"></div>
          <p className="text-dash-muted">読み込み中...</p>
        </div>
      </div>
    );
  }

  // Moodle account not linked
  if (!user?.userid) {
    return (
      <div className="min-h-screen bg-dash-bg flex items-center justify-center">
        <div className="text-center px-6">
          <p className="text-dash-muted font-bold mb-2">セッションが切れました</p>
          <p className="text-sm text-dash-muted mb-4">
            再度ログインしてください。
          </p>
          <Button
            onClick={() => navigate('/login')}
            className="mt-2 rounded-xl px-6 py-2 border-0 text-white"
            style={{ background: 'linear-gradient(135deg, #E0242B, #D30F1A)' }}
          >
            ログイン画面へ
          </Button>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !userProfile) {
    return (
      <div className="min-h-screen bg-dash-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-dash-muted">{error || 'データの読み込みに失敗しました'}</p>
          <Button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl px-6 py-2 border-0 text-white"
            style={{ background: 'linear-gradient(135deg, #E0242B, #D30F1A)' }}
          >
            再読み込み
          </Button>
        </div>
      </div>
    );
  }

  const avatarName = userProfile.nick_name || '';
  const avatarIdentifier = userProfile.avatar_url?.startsWith('http')
    ? userProfile.avatar_url
    : userProfile.avatar_id || userProfile.avatar_url;
  const avatarSrc = withCfToken(resolveAvatarUrl(avatarIdentifier, avatarName), contentToken);

  return (
    <div className="min-h-screen bg-dash-bg flex flex-col">
      <AppHeader
        userName={avatarName}
        avatarUrl={avatarSrc}
      />

      <div className="relative flex-1">
        {/* Main Content */}
        <main className="relative max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
          {/* Profile Card - 3カラム構成（左: アバターパネル／中央: コンテンツ／右: 装飾） */}
          <div className="bg-dash-surface border border-dash-border rounded-[28px] shadow-[0_16px_38px_rgba(96,70,65,0.08)] mb-6 grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_220px] overflow-hidden">
            {/* Left: Avatar パネル（淡いピンクの曲面背景） */}
            <div className="relative flex flex-col items-center justify-center gap-3 py-6 px-6 lg:min-h-[280px]">
              <div
                className="absolute inset-0 pointer-events-none hidden lg:block"
                style={{
                  background:
                    'radial-gradient(circle at 38% 30%, rgba(255,225,227,0.92), transparent 34%), linear-gradient(115deg, rgba(255,248,248,0.82), rgba(255,238,239,0.65))',
                  clipPath: 'ellipse(78% 78% at 0 48%)',
                }}
              />
              <div
                className="relative z-[1] grid place-items-center rounded-full flex-shrink-0 overflow-hidden"
                style={{ width: 84, height: 84, border: '2px solid #FFFFFF', background: 'rgba(255,243,244,0.78)' }}
              >
                <img src={avatarSrc} alt={avatarName} className="w-full h-full object-cover" />
              </div>
              <strong className="relative z-[1] text-sm text-dash-text">{userProfile.nick_name || '未設定'}</strong>
            </div>

            {/* Middle: コンテンツ */}
            <div className="px-6 sm:px-8 py-6 lg:py-8 min-w-0">
              <div className="flex items-center gap-2.5 text-sm font-extrabold text-dash-primary">
                <span
                  className="grid place-items-center rounded-lg flex-shrink-0 text-white"
                  style={{ width: 30, height: 30, background: 'linear-gradient(145deg, #ff888d, #ef4e56)', boxShadow: '0 8px 18px rgba(239,78,86,0.19)' }}
                >
                  <Flag className="w-4 h-4" />
                </span>
                理想のキャリア
              </div>
              <h1 className="mt-3 mb-4 font-bold text-dash-text" style={{ fontSize: 'clamp(18px, 1.8vw, 24px)' }}>
                {userProfile.ideal_career || '未設定'}
              </h1>
              <div className="h-px mb-4" style={{ background: 'linear-gradient(90deg, rgba(224,36,43,0.22), rgba(224,36,43,0.04))' }} />

              <div className="flex items-center gap-2.5 text-sm font-extrabold text-dash-primary">
                <span
                  className="grid place-items-center rounded-lg flex-shrink-0"
                  style={{ width: 26, height: 26, background: '#FFF0F1', color: '#E0242B' }}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                </span>
                今日のスモールステップ
              </div>
              <p className="mt-2 ml-10 text-sm text-dash-text">{userProfile.today_small_step || '未設定'}</p>

              <div className="flex justify-end mt-5">
                <button
                  onClick={() => navigate('/profile')}
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{ border: '1px solid rgba(224,36,43,0.62)', color: '#E0242B', background: 'rgba(255,255,255,0.74)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FFF1F2'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.74)'; }}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  プロフィール編集
                </button>
              </div>
            </div>

            {/* Right: 装飾（花瓶＋写真フレーム。CSSのみ、lg以上でのみ表示） */}
            <div className="hidden lg:flex items-end justify-center gap-4 px-5 py-6" aria-hidden="true">
              <div
                className="relative flex-shrink-0"
                style={{ width: 48, height: 80, borderRadius: '16px 16px 22px 22px', background: 'linear-gradient(145deg, #fff, #eaded8)', boxShadow: '0 8px 22px rgba(88,60,55,0.11)' }}
              >
                {[
                  { left: 6, bottom: 74, rotate: -22 },
                  { left: 16, bottom: 82, rotate: -8 },
                  { left: 26, bottom: 85, rotate: 6 },
                  { left: 35, bottom: 79, rotate: 20 },
                ].map((f, i) => (
                  <span
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      left: f.left, bottom: f.bottom, width: 11, height: 11,
                      background: '#ffacb0', transform: `rotate(${f.rotate}deg)`,
                      boxShadow: '0 0 0 3px rgba(255,204,208,0.5)',
                    }}
                  />
                ))}
              </div>
              <div
                className="flex flex-col items-center justify-center text-center flex-shrink-0"
                style={{
                  width: 76, height: 108, border: '4px solid #f4cbc8', background: '#fffafa', color: '#e77a80',
                  fontStyle: 'italic', fontSize: 11, lineHeight: 1.5, fontFamily: 'Georgia, serif',
                  boxShadow: '0 8px 21px rgba(98,69,64,0.08)',
                }}
              >
                Believe<br />in your<br />journey
              </div>
            </div>
          </div>

          {/* Coaching Goals */}
          <CoachingGoals userId={user?.userid} />

          {/* Course Content */}
          <div className="space-y-6">
            {/* Resume Course Card */}
            {resumableCourse && (
              <div className="bg-dash-surface border border-dash-border rounded-[28px] shadow-[0_4px_24px_rgba(23,29,42,0.05)] overflow-hidden">
                <div className="flex flex-col sm:flex-row">
                  {/* Left Content */}
                  <div className="flex-1 p-6 sm:p-8">
                    <div className="inline-block px-4 py-1.5 bg-dash-soft text-dash-primary text-sm font-semibold rounded-full mb-4">
                      前回のつづき
                    </div>

                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-[3px] h-7 bg-dash-primary rounded-full mt-0.5 flex-shrink-0"></div>
                      <h3 className="text-2xl font-semibold text-dash-text">
                        {resumableCourse.title}
                      </h3>
                    </div>

                    {resumableCourse.currentLesson && (
                      <div className="inline-block px-3 py-1.5 bg-dash-soft rounded-lg mb-5">
                        <span className="text-sm font-medium text-dash-muted">
                          {resumableCourse.currentLesson}
                        </span>
                      </div>
                    )}

                    <div className="mb-5">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-xs text-dash-muted">進捗率</span>
                        <span className="text-base font-semibold text-dash-primary">{resumableCourse.progress || 0}%</span>
                      </div>
                      <div className="h-2 bg-[#EFEFEF] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${resumableCourse.progress || 0}%`,
                            background: 'linear-gradient(90deg, #E0242B, #D30F1A)',
                          }}
                        />
                      </div>
                    </div>

                    <Button
                      onClick={() => navigate(`/course/${resumableCourse.id}/curriculum`)}
                      className="w-full rounded-xl px-6 py-3 flex items-center justify-center gap-2 border-0 text-white transition-all hover:brightness-105 focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                      style={{ background: 'linear-gradient(135deg, #E0242B, #D30F1A)' }}
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
                  <h3 className="text-lg font-bold text-dash-muted">
                    学習中のコース
                  </h3>
                  <button
                    onClick={() => navigate('/learning-courses')}
                    className="text-xs font-medium text-dash-muted bg-dash-surface hover:bg-dash-soft flex items-center gap-1 border border-dash-border rounded-full px-4 py-1.5 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  >
                    すべて見る
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {activeCourses.slice(0, 6).map((course) => (
                    <div
                      key={course.id}
                      className="bg-dash-surface rounded-2xl shadow-sm border border-dash-border overflow-hidden cursor-pointer hover:shadow-md transition-shadow flex flex-col"
                      onClick={() => navigate(`/course/${course.id}/curriculum`)}
                    >
                      {/* Thumbnail */}
                      <div className="relative w-full aspect-video overflow-hidden bg-[#E8E4E0]">
                        <CourseImage
                          imageUrl={course.thumbnailUrl}
                          alt={course.title}
                          fallbackColor="#E8E4E0"
                          className="w-full h-full object-cover"
                          style={{ height: '100%' }}
                          hideFallbackText
                        />
                        {course.categoryName && (
                          <span className="absolute top-2 left-2 text-[10px] font-bold text-dash-muted bg-white bg-opacity-90 rounded px-2 py-0.5">
                            {course.categoryName}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-4 flex flex-col flex-1">
                        <h4 className="text-sm font-bold text-dash-text mb-3 line-clamp-2 flex-1">
                          {course.title}
                        </h4>

                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-1.5 flex-1 bg-[#EFEFEF] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${course.progress || 0}%`,
                                background: 'linear-gradient(90deg, #E0242B, #D30F1A)',
                              }}
                            />
                          </div>
                          <span className="text-xs font-bold text-dash-primary min-w-[32px] text-right">{course.progress || 0}%</span>
                        </div>

                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/course/${course.id}/curriculum`); }}
                          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-white text-sm font-bold transition-all hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                          style={{ background: 'linear-gradient(90deg, #E0242B, #D30F1A)' }}
                        >
                          続きから学習する
                          <Play className="w-3.5 h-3.5 fill-white" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-brand-footer h-10 flex items-center justify-center">
        <span className="text-[11.4px] font-bold text-white">
          2026 &copy; WEBCOACH
        </span>
      </footer>
    </div>
  );
}

export default MyPage;
