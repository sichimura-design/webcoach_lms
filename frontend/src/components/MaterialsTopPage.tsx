import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { AppHeader, MascotSvg, RoadmapPath } from './shared';
import { useAuth } from '../contexts/AuthContext';
import { useMypageData } from '../hooks/useMypageData';
import { useLearningSummary } from '../hooks/useLearningSummary';
import { useRoadmapSteps } from '../hooks/useRoadmapSteps';
import { useCommunityPulse } from '../hooks/useCommunityPulse';
import { useChatStore } from '../store/chatStore';
import { Course } from '../types/mypage';

const CATEGORY_COLORS: Record<string, string> = {
  Webデザイン: '#E0213A',
  コーディング: '#D9930D',
  マーケティング: '#8B5CD6',
  キャリア: '#2FA35C',
};

function categoryColor(name?: string): string {
  return (name && CATEGORY_COLORS[name]) || '#8B5CD6';
}

function courseBadge(course: Course): { label: string; bg: string; color: string } | null {
  const progress = course.progress ?? 0;
  if (progress >= 100) return { label: '修了！', bg: '#EAF6ED', color: '#2FA35C' };
  if (progress > 0) return { label: 'がんばり中！', bg: '#FBEACD', color: '#B98A16' };
  return null;
}

function formatMinutesHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}時間${m}分` : `${m}分`;
}

function MaterialsTopPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const setChatOpen = useChatStore((s) => s.setChatOpen);
  const { userProfile, resumableCourse, activeCourses, streak } = useMypageData(user?.userid);
  const { steps: roadmapSteps } = useRoadmapSteps(user?.userid);
  const { pulse } = useCommunityPulse();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('すべて');

  const learningCourses: Course[] = resumableCourse
    ? [resumableCourse, ...activeCourses.filter((c) => c.id !== resumableCourse.id)]
    : activeCourses;
  const learningSummary = useLearningSummary(learningCourses);

  const categories = useMemo(() => {
    const names = Array.from(new Set(learningCourses.map((c) => c.categoryName).filter(Boolean))) as string[];
    return ['すべて', ...names];
  }, [learningCourses]);

  const filteredCourses = learningCourses.filter((c) => {
    if (filter !== 'すべて' && c.categoryName !== filter) return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const nextRecommendedStep = roadmapSteps.find((s) => s.status !== 'done');

  return (
    <div className="min-h-screen bg-dash-bg flex flex-col">
      <AppHeader userName={user?.username || 'User'} />

      <main className="relative mx-auto grid" style={{ maxWidth: 1440, paddingTop: 32, paddingBottom: 40, paddingLeft: 24, paddingRight: 24, gridTemplateColumns: '1fr 300px', gap: 22, alignItems: 'start' }}>
        <div className="flex flex-col" style={{ gap: 20 }}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 190px 190px', gap: 16 }}>
            <div className="flex items-center" style={{ gap: 18, background: 'linear-gradient(120deg,#FBDCE2,#F9CDD6)', borderRadius: 20, padding: '18px 22px' }}>
              <MascotSvg size={64} cheeks />
              <div>
                <div style={{ fontSize: 17, fontWeight: 900 }}>こんにちは、{userProfile?.nick_name || ''}さん！ 👋</div>
                <div style={{ fontSize: 12, color: '#A05A6B', marginTop: 4 }}>一緒に続けていこう！あなたならできるよ〜！</div>
              </div>
            </div>
            <div className="bg-white" style={{ borderRadius: 20, boxShadow: '0 10px 30px rgba(190,60,70,.08)', padding: 16 }}>
              <div style={{ fontSize: 11, color: '#8A767D' }}>今週の学習時間</div>
              <div style={{ fontSize: 21, fontWeight: 900, marginTop: 3 }}>{formatMinutesHM(learningSummary.thisWeekMinutes)}</div>
              <div style={{ height: 6, borderRadius: 999, background: '#F5E4E6', overflow: 'hidden', marginTop: 9 }}>
                <div style={{ width: `${Math.min(100, Math.round((learningSummary.thisWeekMinutes / (userProfile?.weekly_target_minutes ?? 600)) * 100))}%`, height: '100%', background: 'linear-gradient(90deg,#F0546A,#E0213A)', borderRadius: 999 }} />
              </div>
              <div style={{ fontSize: 10, color: '#B78F98', marginTop: 5 }}>目標：{formatMinutesHM(userProfile?.weekly_target_minutes ?? 600)}</div>
            </div>
            <div className="bg-white" style={{ borderRadius: 20, boxShadow: '0 10px 30px rgba(190,60,70,.08)', padding: 16 }}>
              <div style={{ fontSize: 11, color: '#8A767D' }}>連続学習日数</div>
              <div style={{ fontSize: 21, fontWeight: 900, color: '#E0213A', marginTop: 3 }}>{streak?.days ?? 0}日</div>
              <div style={{ fontSize: 10, color: '#B78F98', marginTop: 14 }}>
                {streak && (streak.best === undefined || streak.days >= streak.best) ? '自己ベスト更新中！ 🔥' : `自己ベスト ${streak?.best}日`}
              </div>
            </div>
          </div>

          {roadmapSteps.length > 0 && (
            <div className="bg-white" style={{ borderRadius: 20, boxShadow: '0 10px 30px rgba(190,60,70,.08)', padding: '18px 24px' }}>
              <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: 14 }}>
                <div className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 900 }}>
                  <span style={{ background: '#FBEACD', borderRadius: 8, padding: '3px 7px' }}>🛡</span>
                  コーチと決めたロードマップ
                </div>
                <span style={{ fontSize: 11, color: '#B78F98' }}>
                  目標：3ヶ月でLP公開 <span onClick={() => navigate('/profile')} style={{ color: '#E0213A', fontWeight: 700, cursor: 'pointer' }}>変更 ›</span>
                </span>
              </div>
              <RoadmapPath steps={roadmapSteps} />
            </div>
          )}

          <div className="grid" style={{ gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
            {primaryCourseCard(resumableCourse, navigate)}
            {nextRecommendedStep && (
              <div
                onClick={nextRecommendedStep.onClick}
                className="bg-white flex items-center cursor-pointer"
                style={{ borderRadius: 20, boxShadow: '0 10px 30px rgba(190,60,70,.08)', padding: '18px 22px', gap: 14 }}
              >
                <span className="flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, borderRadius: 12, background: '#FBEACD', fontSize: 17 }}>⭐</span>
                <div className="flex-1">
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#B98A16' }}>あなたへのおすすめ</div>
                  <div style={{ fontSize: 14, fontWeight: 900 }}>次は「{nextRecommendedStep.label}」がおすすめ</div>
                  <div style={{ fontSize: 11, color: '#A9909A', marginTop: 3 }}>ロードマップの次のステップです</div>
                </div>
                <span style={{ color: '#C99' }}>›</span>
              </div>
            )}
          </div>

          <div
            className="flex items-center"
            style={{ border: '1px solid rgba(255,255,255,.9)', background: 'rgba(255,255,255,.85)', borderRadius: 999, padding: '15px 24px', boxShadow: '0 8px 20px rgba(200,90,110,.08)' }}
          >
            <Search className="w-4 h-4 flex-shrink-0" style={{ color: '#B7A0A7' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="コース名・キーワードで検索（例：バナー、JavaScript、SEO）"
              className="flex-1 bg-transparent outline-none"
              style={{ border: 'none', fontSize: 13, marginLeft: 10 }}
            />
          </div>

          <div className="flex items-center justify-between">
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900 }}>マイコース</h2>
            <span style={{ fontSize: 12, color: '#8A767D' }}>
              並び替え <span style={{ background: '#fff', borderRadius: 999, padding: '6px 14px', fontWeight: 700, boxShadow: '0 4px 12px rgba(200,90,110,.08)', cursor: 'pointer' }}>進捗が高い順 ▾</span>
            </span>
          </div>

          <div className="flex flex-wrap" style={{ gap: 9 }}>
            {categories.map((f) => (
              <span
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  borderRadius: 999, padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  background: filter === f ? '#E0213A' : '#fff',
                  color: filter === f ? '#fff' : '#6B575E',
                  border: filter === f ? 'none' : '1px solid #EDD8DB',
                }}
              >
                {f}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 18 }}>
            {filteredCourses.map((c) => {
              const badge = courseBadge(c);
              const progress = c.progress ?? 0;
              const totalLessons = c.totalLessons ?? 6;
              const currentLessonN = Math.max(1, Math.round((progress / 100) * totalLessons));
              return (
                <div
                  key={c.id}
                  onClick={() => navigate(`/course/${c.id}/curriculum`)}
                  className="bg-white flex flex-col cursor-pointer"
                  style={{ borderRadius: 20, boxShadow: '0 10px 30px rgba(190,60,70,.08)', padding: 18, gap: 10 }}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ background: categoryColor(c.categoryName), color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '3px 11px' }}>
                      {c.categoryName || 'カテゴリ'}
                    </span>
                    {badge && (
                      <span style={{ background: badge.bg, color: badge.color, fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '3px 10px' }}>{badge.label}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.4 }}>{c.title}</div>
                  <div className="flex-1" style={{ fontSize: 11, color: '#A9909A' }}>{c.description}</div>
                  <div className="flex items-end justify-between">
                    <div className="flex-1">
                      <div style={{ fontSize: 11, color: '#8A767D', marginBottom: 6 }}>Lesson {currentLessonN} / {totalLessons}</div>
                      <div style={{ height: 7, borderRadius: 999, background: '#F5E4E6', overflow: 'hidden', marginRight: 14 }}>
                        <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg,#F0546A,#E0213A)', borderRadius: 999 }} />
                      </div>
                    </div>
                    <MascotSvg size={44} />
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/course/${c.id}/curriculum`); }}
                    className="appearance-none border-0 outline-none text-white font-bold focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                    style={{ background: 'linear-gradient(120deg,#F0546A,#E0213A)', borderRadius: 999, padding: 11, fontSize: 13 }}
                  >
                    {progress >= 100 ? 'もう一度' : progress > 0 ? '続きから' : 'はじめる'} ▸
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col" style={{ gap: 18 }}>
          <div className="bg-white flex flex-col" style={{ borderRadius: 20, boxShadow: '0 10px 30px rgba(190,60,70,.08)', padding: 20, gap: 13 }}>
            <div className="flex items-center gap-2" style={{ fontSize: 14, fontWeight: 900 }}>
              <span style={{ color: '#E0213A' }}>👥</span> いま一緒に学んでいる人たち
            </div>
            {pulse && <div style={{ fontSize: 11, fontWeight: 700, color: '#E0213A' }}>{pulse.totalToday}人が学習中！</div>}
            {pulse?.activityFeed.slice(0, 5).map((m) => (
              <div key={m.id} className="flex items-center" style={{ gap: 10 }}>
                <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 34, height: 34, background: '#F6D2D2', fontSize: 15 }}>{m.avatarEmoji}</span>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{m.nickname}</div>
                  <div style={{ fontSize: 10, color: '#A9909A' }}>{m.activityLabel}</div>
                </div>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2FA35C', flexShrink: 0 }} />
              </div>
            ))}
            <button
              onClick={() => navigate('/focus-booth')}
              className="appearance-none border-0 outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{ background: '#fff', color: '#E0213A', border: '1.5px solid #EEC0C4', borderRadius: 999, padding: 11, fontWeight: 700, fontSize: 12 }}
            >
              👥 みんなの学習部屋に入る
            </button>
          </div>

          <div className="bg-white flex flex-col" style={{ borderRadius: 20, boxShadow: '0 10px 30px rgba(190,60,70,.08)', padding: 20, gap: 13 }}>
            <div className="flex items-start" style={{ gap: 12 }}>
              <MascotSvg size={46} />
              <div style={{ background: '#FDF0F2', borderRadius: '4px 14px 14px 14px', padding: '12px 14px', fontSize: 12, lineHeight: 1.7, color: '#5A4A50' }}>
                {userProfile?.nick_name || ''}さん、すごいよ〜！コツコツ続けてえらい！この調子で一緒にゴールしようね ✨
              </div>
            </div>
            <button
              onClick={() => setChatOpen(true)}
              className="appearance-none border-0 outline-none text-white font-bold focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{ background: 'linear-gradient(120deg,#F0546A,#E0213A)', borderRadius: 999, padding: 12, fontSize: 12, boxShadow: '0 8px 20px rgba(224,33,58,.3)' }}
            >
              💬 コーチに質問してみる
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function primaryCourseCard(resumableCourse: Course | null, navigate: (path: string) => void) {
  if (!resumableCourse) return <div />;
  return (
    <div
      onClick={() => navigate(`/course/${resumableCourse.id}/curriculum`)}
      className="bg-white flex items-center cursor-pointer"
      style={{ borderRadius: 20, boxShadow: '0 10px 30px rgba(190,60,70,.08)', padding: '18px 22px', gap: 16 }}
    >
      <div className="flex items-center justify-center flex-shrink-0" style={{ width: 50, height: 50, borderRadius: 14, background: 'linear-gradient(120deg,#F0546A,#E0213A)', color: '#fff', fontSize: 19 }}>▶</div>
      <div className="flex-1">
        <div style={{ fontSize: 11, fontWeight: 700, color: '#E0213A' }}>続きから始める ・ {resumableCourse.currentLesson || 'Lesson 4'}</div>
        <div style={{ fontSize: 15, fontWeight: 900 }}>{resumableCourse.title}</div>
        <div className="flex items-center gap-2.5" style={{ marginTop: 7 }}>
          <div className="flex-1" style={{ height: 7, borderRadius: 999, background: '#F5E4E6', overflow: 'hidden' }}>
            <div style={{ width: `${resumableCourse.progress ?? 0}%`, height: '100%', background: 'linear-gradient(90deg,#F0546A,#E0213A)', borderRadius: 999 }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#E0213A' }}>{resumableCourse.progress ?? 0}%</span>
        </div>
      </div>
      <button
        className="appearance-none border-0 outline-none text-white font-bold focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{ background: 'linear-gradient(120deg,#F0546A,#E0213A)', borderRadius: 999, padding: '11px 20px', fontSize: 13, boxShadow: '0 8px 20px rgba(224,33,58,.3)' }}
      >
        続きから ▸
      </button>
    </div>
  );
}

export default MaterialsTopPage;
