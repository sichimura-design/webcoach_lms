import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';
import { AppHeader } from './shared';
import { useMypageData } from '../hooks/useMypageData';
import { useDailyTodos } from '../hooks/useDailyTodos';
import { useCommunityPulse } from '../hooks/useCommunityPulse';
import { useLearningSummary } from '../hooks/useLearningSummary';
import { useJourney } from '../hooks/useJourney';
import { useRecentBadges } from '../hooks/useRecentBadges';
import { useProgressionStore } from '../store/progressionStore';
import { EXP_RULES } from '../utils/progression';
import { CoachingGoals } from './mypage/CoachingGoals';
import TodayMission from './mypage/TodayMission';
import PeopleActivityCard from './mypage/PeopleActivityCard';
import LearningSummaryCard from './mypage/LearningSummaryCard';
import { Course } from '../types/mypage';

function MyPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const {
    userProfile,
    resumableCourse,
    activeCourses,
    streak,
    loading: isLoading,
    error,
    refetch: refetchMypageData,
  } = useMypageData(user?.userid);

  const { todos, toggleTodo, reload: reloadTodos } = useDailyTodos(user?.userid);
  const { pulse } = useCommunityPulse();
  const { journey } = useJourney(user?.userid);
  const { badges } = useRecentBadges(user?.userid);
  const noteStreakDays = useProgressionStore((s) => s.noteStreakDays);

  // 「学習中のコース」= 続きから(resumableCourse) + 受講中一覧。id重複は除外
  const learningCourses: Course[] = resumableCourse
    ? [resumableCourse, ...activeCourses.filter(c => c.id !== resumableCourse.id)]
    : activeCourses;

  const learningSummary = useLearningSummary(learningCourses);

  const questCourse = learningCourses.find(c => c.id === journey?.todayQuest?.courseId);
  const primaryCourse = learningCourses[0];
  const secondaryCourse = learningCourses[1];

  // コーチング目標の保存に連動して「今日のスモールステップ」「今日のTODO」が
  // 更新されるため、両方のデータを再取得して画面に反映する
  const handleGoalsLinkedUpdate = () => {
    refetchMypageData();
    reloadTodos();
  };

  // ストリークが新たに伸びたタイミングでEXPボーナスを1度だけ付与
  useEffect(() => {
    if (streak?.days !== undefined) {
      noteStreakDays(streak.days, EXP_RULES.STREAK_DAY_BONUS);
    }
  }, [streak?.days, noteStreakDays]);

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
            style={{ background: 'linear-gradient(135deg, #E0213A, #B81026)' }}
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
            style={{ background: 'linear-gradient(135deg, #E0213A, #B81026)' }}
          >
            再読み込み
          </Button>
        </div>
      </div>
    );
  }

  const avatarName = userProfile.nick_name || '';

  return (
    <div className="min-h-screen bg-dash-bg flex flex-col">
      <AppHeader userName={avatarName} />

      <div className="relative flex-1">
        <main
          className="relative mx-auto flex flex-col"
          style={{ maxWidth: 1440, paddingTop: 32, paddingBottom: 40, paddingLeft: 24, paddingRight: 24, gap: 22 }}
        >
          {/* ヘッダ */}
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: '#20141A' }}>
                おかえりなさい、{avatarName || 'さん'}
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#B78F98' }}>今日も一歩、理想の未来へ進みましょう。</p>
            </div>
            <span
              className="inline-flex items-center gap-1.5"
              style={{ background: 'rgba(255,255,255,.85)', border: '1px solid rgba(255,255,255,.9)', borderRadius: 999, padding: '9px 16px', fontSize: 13, fontWeight: 700, boxShadow: '0 6px 16px rgba(200,90,110,.1)' }}
            >
              <span style={{ color: '#E0213A' }}>🔥</span> {streak?.days ?? 0} 日連続
            </span>
          </div>

          {/* 上段: 目標カード + 学習中のコース */}
          <div className="grid" style={{ gridTemplateColumns: '1fr 380px', gap: 22, alignItems: 'stretch' }}>
            <CoachingGoals userId={user?.userid} onLinkedUpdate={handleGoalsLinkedUpdate} />

            <div
              className="bg-white flex flex-col"
              style={{ borderRadius: 22, boxShadow: '0 10px 30px rgba(190,60,70,.08)', padding: 24, gap: 16 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2" style={{ fontSize: 16, fontWeight: 900 }}>
                  <span style={{ color: '#E0213A' }}>▤</span> 学習中のコース
                </div>
                <button
                  onClick={() => navigate('/courses')}
                  className="appearance-none border-0 outline-none bg-transparent focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{ fontSize: 12, fontWeight: 700, color: '#E0213A' }}
                >
                  すべて ›
                </button>
              </div>

              {primaryCourse && (
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => navigate(`/course/${primaryCourse.id}/curriculum`)}
                >
                  <div
                    className="flex items-center justify-center flex-shrink-0"
                    style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(120deg,#F0546A,#E0213A)', color: '#fff', fontSize: 20 }}
                  >
                    ▣
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#E0213A' }}>続きから・{primaryCourse.currentLesson || 'Lesson 4'}</div>
                    <div style={{ fontSize: 15, fontWeight: 900 }}>{primaryCourse.title}</div>
                  </div>
                </div>
              )}
              {primaryCourse && (
                <div className="flex items-center gap-2.5">
                  <div className="flex-1" style={{ height: 8, borderRadius: 999, background: '#F5E4E6', overflow: 'hidden' }}>
                    <div style={{ width: `${primaryCourse.progress ?? 0}%`, height: '100%', background: 'linear-gradient(90deg,#F0546A,#E0213A)', borderRadius: 999 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#E0213A' }}>{primaryCourse.progress ?? 0}%</span>
                </div>
              )}
              {secondaryCourse && (
                <div className="flex items-center gap-2.5" style={{ fontSize: 13, color: '#6B575E' }}>
                  <span className="flex-1 min-w-0 truncate">{secondaryCourse.title}</span>
                  <div style={{ width: 90, height: 6, borderRadius: 999, background: '#F5E4E6', overflow: 'hidden' }}>
                    <div style={{ width: `${secondaryCourse.progress ?? 0}%`, height: '100%', background: '#E0213A', borderRadius: 999 }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#E0213A' }}>{secondaryCourse.progress ?? 0}%</span>
                </div>
              )}

              <div className="flex-1" />

              {primaryCourse && (
                <button
                  onClick={() => navigate(`/course/${primaryCourse.id}/curriculum`)}
                  className="appearance-none border-0 outline-none text-white font-bold focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{ background: 'linear-gradient(120deg,#F0546A,#E0213A)', borderRadius: 999, padding: 14, fontSize: 14, boxShadow: '0 10px 24px rgba(224,33,58,.35)' }}
                >
                  続きから学習 ▸
                </button>
              )}
            </div>
          </div>

          {/* 下段: 今日のミッション / 他の人の様子 / 学習サマリー・実績 */}
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 22, alignItems: 'start' }}>
            <TodayMission
              quest={journey?.todayQuest ?? null}
              questCourse={questCourse}
              todos={todos}
              onToggleTodo={toggleTodo}
              onOpenQuest={() => {
                if (journey?.todayQuest?.courseId) navigate(`/course/${journey.todayQuest.courseId}/curriculum`);
              }}
            />
            {pulse && <PeopleActivityCard pulse={pulse} />}
            <LearningSummaryCard
              studyMinutes={learningSummary.studyMinutes}
              completedLessons={learningSummary.completedLessons}
              thisWeekMinutes={learningSummary.thisWeekMinutes}
              weeklyTargetMinutes={userProfile.weekly_target_minutes ?? 600}
              streakDays={streak?.days ?? 0}
              streakBest={streak?.best}
              weekActivity={streak?.week ?? []}
              badges={badges}
            />
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
