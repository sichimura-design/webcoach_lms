import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, ChevronRight, Sparkles, LayoutGrid } from 'lucide-react';
import { bffClient } from '../services/bffClient';
import { AppHeader } from './shared';
import { CourseImage } from './shared/CourseImage';
import { useAuth } from '../contexts/AuthContext';
import { useAsyncData } from '../hooks/useAsyncData';

function LearningCoursesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useAsyncData(
    () => user?.userid
      ? bffClient.getUserCourses(user.userid)
      : Promise.resolve([]),
    [user?.userid],
  );
  const { data: recommend } = useAsyncData<any[]>(() => bffClient.getRecommendCourses(), []);
  const courses: any[] = data ?? [];
  const inProgress = courses.filter(c => (c.progress ?? 0) < 100);
  const completed = courses.filter(c => (c.progress ?? 0) >= 100);
  const recommended: any[] = recommend ?? [];

  const formatLastAccess = (timestamp?: number) => {
    if (!timestamp) return '';
    const d = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);

    if (hours < 1) return '最終: たった今';
    if (hours < 24) return `最終: ${hours}時間前`;
    if (days < 7) return `最終: ${days}日前`;
    return `最終: ${weeks}週間前`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand mx-auto mb-4"></div>
          <p className="text-brand-muted">読み込み中...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && courses.length === 0) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-brand-muted mb-4">{error}</p>
          <button
            onClick={refetch}
            className="bg-brand hover:bg-brand/90 text-white font-bold px-6 py-2 rounded-xl transition-colors"
          >
            再読み込み
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      <AppHeader userName={user?.username || 'User'} />

      {/* Background with gradient circles */}
      <div className="relative flex-1">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute w-[1152px] h-[1152px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(232,109,120,0.3) 0%, transparent 70%)', top: '-200px', left: '-300px' }}
          />
          <div
            className="absolute w-[1152px] h-[1152px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(250,145,97,0.3) 0%, transparent 70%)', top: '-100px', right: '-400px' }}
          />
          <div
            className="absolute w-[1152px] h-[1152px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(255,234,225,0.5) 0%, transparent 70%)', bottom: '-300px', left: '50%' }}
          />
        </div>

        {/* Decorative blurred circles */}
        <div className="absolute right-[5%] top-[30%] w-48 h-48 rounded-full bg-[#E8F5E9] blur-[60px] opacity-40 pointer-events-none" />
        <div className="absolute left-[3%] bottom-[10%] w-64 h-64 rounded-full bg-brand blur-[80px] opacity-10 pointer-events-none" />

        {/* Main Content */}
        <main className="relative max-w-[850px] mx-auto px-4 sm:px-6 py-8">
          {/* Back Button */}
          <button
            onClick={() => navigate('/mypage')}
            className="w-10 h-10 rounded-full bg-brand-bg hover:bg-[#F0EAE6] border border-brand-bg flex items-center justify-center transition-colors mb-6"
          >
            <ArrowLeft className="w-5 h-5 text-[#5D5555]" />
          </button>

          {/* Header */}
          <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-6 h-6 text-brand-muted" />
              <h2 className="text-2xl font-bold text-brand-muted">学習コース</h2>
            </div>
            <button
              onClick={() => navigate('/courses')}
              className="inline-flex items-center gap-1.5 text-sm font-bold rounded-full px-4 py-2 bg-white border border-brand-border text-brand-text hover:bg-[#FFF5F0] transition-colors"
            >
              <LayoutGrid className="w-4 h-4 text-brand" /> コース一覧（カタログ）へ
            </button>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          {courses.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-brand-muted mb-4">まだ受講中のコースはありません。</p>
              <button onClick={() => navigate('/courses')} className="inline-flex items-center gap-1.5 text-sm font-bold text-white rounded-full px-5 py-2.5" style={{ background: 'linear-gradient(135deg, #E86D78, #FA9262)' }}>
                <LayoutGrid className="w-4 h-4" /> コースを探す
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-8">
              {/* 学習中 */}
              <section>
                <h3 className="text-sm font-bold text-brand-muted mb-3">学習中（{inProgress.length}）</h3>
                {inProgress.length === 0 ? (
                  <p className="text-sm text-brand-subtle">学習中のコースはありません。</p>
                ) : (
                  <div className="space-y-4">
                    {inProgress.map(c => <CourseRow key={c.id} course={c} onClick={() => navigate(`/course/${c.id}/curriculum`)} lastAccessLabel={formatLastAccess(c.lastaccess)} />)}
                  </div>
                )}
              </section>

              {/* 学習済み */}
              {completed.length > 0 && (
                <section>
                  <h3 className="text-sm font-bold text-brand-muted mb-3">学習済み（{completed.length}）</h3>
                  <div className="space-y-4">
                    {completed.map(c => <CourseRow key={c.id} course={c} onClick={() => navigate(`/course/${c.id}/curriculum`)} lastAccessLabel={formatLastAccess(c.lastaccess)} done />)}
                  </div>
                </section>
              )}

              {/* おすすめ（同じフェーズの人が学ぶコース） */}
              {recommended.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-brand" />
                    <h3 className="text-sm font-bold text-brand-text">同じフェーズの人が学んでいるコース</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {recommended.map(c => (
                      <button key={c.id} onClick={() => navigate(`/courses/category/${c.categoryid}`)} className="bg-white rounded-2xl shadow-sm p-4 text-left hover:shadow-md transition-shadow flex flex-col gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full self-start" style={{ background: '#FFF0EF', color: '#E8657A' }}>{c.categoryname}</span>
                        <span className="text-sm font-bold text-brand-text">{c.fullname}</span>
                        <span className="text-xs text-brand-muted line-clamp-2">{c.summary}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-brand-footer h-10 flex items-center justify-center">
        <span className="text-[11.4px] font-bold text-white" style={{ letterSpacing: '0.6px' }}>
          2026 &copy; WEBCOACH
        </span>
      </footer>
    </div>
  );
}

function CourseRow({ course, onClick, lastAccessLabel, done }: { course: any; onClick: () => void; lastAccessLabel?: string; done?: boolean }) {
  const progress = Math.round(course.progress ?? 0);
  return (
    <div className="bg-white rounded-3xl shadow-sm p-5 sm:p-6 flex items-start gap-3 sm:gap-4 hover:shadow-md transition-shadow" style={{ borderRadius: '24px' }}>
      <div className="w-[52px] h-[52px] rounded-xl overflow-hidden flex-shrink-0">
        <CourseImage imageUrl={course.overviewfiles?.[0]?.fileurl} alt={course.displayname || course.fullname} fallbackColor="#FFF5D6" hideFallbackText className="w-full h-full" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h3 className="text-lg sm:text-xl font-bold text-brand-text truncate">{course.displayname || course.fullname}</h3>
          {done && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#E4F3EC', color: '#2F9E6E' }}>修了</span>}
          {!done && lastAccessLabel && (
            <span className="text-[10px] text-brand-muted bg-[#FAFAFA] border border-brand-border rounded-full px-2.5 py-1 flex-shrink-0 whitespace-nowrap">{lastAccessLabel}</span>
          )}
        </div>
        {course.summary && (
          <p className="text-[11px] text-brand-muted mb-2 line-clamp-1">{course.summary}</p>
        )}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-2.5 flex-1 bg-[#EFEFEF] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: done ? '#2FA372' : '#FA9161' }} />
            </div>
            <span className="text-sm font-bold min-w-[36px] text-right" style={{ color: done ? '#2FA372' : '#FA9161' }}>{progress}%</span>
          </div>
          <button onClick={onClick} className="flex items-center gap-1.5 px-4 py-2 bg-[#FFF8F5] border border-[#FA9161] rounded-3xl text-sm text-[#FA9161] hover:bg-[#FFF0EA] transition-colors flex-shrink-0">
            <span className="text-xs font-medium">{done ? '復習する' : '学習ページへ'}</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default LearningCoursesPage;
