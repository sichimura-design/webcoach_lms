import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';
import { AppHeader } from './shared';
import { useMypageData } from '../hooks/useMypageData';
import { useLearningSummary } from '../hooks/useLearningSummary';
import { useFocusBoothMembers } from '../hooks/useFocusBoothMembers';
import { useProgressionStore } from '../store/progressionStore';
import { useScaleToFit } from '../hooks/useScaleToFit';
import { EXP_RULES } from '../utils/progression';
import ContinueLearningHero from './mypage/ContinueLearningHero';
import PeopleActivityCard from './mypage/PeopleActivityCard';
import GuildLobbyCard from './mypage/GuildLobbyCard';
import NextCoachingPlan from './mypage/NextCoachingPlan';
import RoadmapSection from './mypage/RoadmapSection';
import StatsStrip from './mypage/StatsStrip';
import { Course } from '../types/mypage';
import { color, font, space } from '../theme/webcoachTheme';

const DESIGN_WIDTH = 1440;
const WEEKDAY_KANJI = ['日', '月', '火', '水', '木', '金', '土'];

function formatTodayLabel(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${WEEKDAY_KANJI[date.getDay()]}）`;
}

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
  } = useMypageData(user?.userid);

  const { members } = useFocusBoothMembers();
  const noteStreakDays = useProgressionStore((s) => s.noteStreakDays);
  const { outerRef, innerRef, scale, innerHeight } = useScaleToFit(DESIGN_WIDTH);

  // 「学習中のコース」= 続きから(resumableCourse) + 受講中一覧。id重複は除外
  const learningCourses: Course[] = resumableCourse
    ? [resumableCourse, ...activeCourses.filter(c => c.id !== resumableCourse.id)]
    : activeCourses;

  const learningSummary = useLearningSummary(learningCourses);
  const primaryCourse = learningCourses[0];
  const completedCourses = learningCourses.filter(c => (c.progress ?? 0) >= 100).length;

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
  const handleContinue = () => primaryCourse && navigate(`/course/${primaryCourse.id}/curriculum`);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: color.pageBg }}>
      <AppHeader userName={avatarName} />

      <div className="relative flex-1">
        <div
          ref={outerRef}
          style={{ width: '100%', maxWidth: DESIGN_WIDTH, margin: '0 auto', position: 'relative', height: innerHeight ? innerHeight * scale : undefined }}
        >
        <main
          ref={innerRef}
          className="home-main flex flex-col"
          style={{ position: 'absolute', top: 0, left: 0, width: DESIGN_WIDTH, boxSizing: 'border-box', gap: space.sectionGap, fontFamily: font.family, color: color.text, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          {/* ヘッダ: 日付＋挨拶＋赤アンダーライン / ストリーク＋週間ドット */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, paddingBottom: 2 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: color.textSubtle, letterSpacing: '.2px' }}>{formatTodayLabel(new Date())}</div>
              <div style={{ ...font.pageTitle, color: color.text, marginTop: 10 }}>おかえりなさい、{avatarName || 'さん'}！</div>
              <div style={{ width: 96, height: 3, borderRadius: 2, background: color.primary, marginTop: 9 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: 17, lineHeight: 1 }}>🔥</span>
                <span style={{ ...font.streakNumber, color: color.primary }}>{streak?.days ?? 0}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: color.primary }}>日連続</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                {(streak?.week ?? []).map((d, i) => (
                  <span key={i} style={{ width: 11, height: 11, borderRadius: '50%', background: d.studied ? color.primary : color.streakOff }} />
                ))}
              </div>
            </div>
          </div>

          {/* 一番見たい: 続きから学習 */}
          {primaryCourse && <ContinueLearningHero course={primaryCourse} onOpen={handleContinue} />}

          {/* 次に見たい: 目標 / ギルドロビー / ギルドメンバー */}
          <div className="home-3col" style={{ alignItems: 'stretch' }}>
            <NextCoachingPlan userId={user?.userid} onContinue={handleContinue} />
            <GuildLobbyCard onlineCount={members.length} />
            <PeopleActivityCard />
          </div>

          {/* 次に見たい: 累計・今週の学習量 */}
          <StatsStrip
            thisWeekMinutes={learningSummary.thisWeekMinutes}
            weekDeltaMinutes={learningSummary.studyMinutes.weekDelta}
            weeklyTargetMinutes={userProfile.weekly_target_minutes ?? 600}
            totalStudyMinutes={learningSummary.studyMinutes.total}
            completedLessons={learningSummary.completedLessons.total}
            completedCourses={completedCourses}
          />

          {/* 今後の学習計画（ロードマップ） */}
          <RoadmapSection userId={user?.userid} />
        </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="h-10 flex items-center justify-center" style={{ background: '#2B2629' }}>
        <span className="text-[11.4px] font-bold text-white">
          2026 &copy; WEBCOACH
        </span>
      </footer>
    </div>
  );
}

export default MyPage;
