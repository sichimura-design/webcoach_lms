import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';
import { AppHeader } from './shared';
import { useMypageData } from '../hooks/useMypageData';
import { useLearningSummary } from '../hooks/useLearningSummary';
import { useStudyStats } from '../hooks/useStudyStats';
import { useProgressionStore } from '../store/progressionStore';
import { useScaleToFit } from '../hooks/useScaleToFit';
import { EXP_RULES } from '../utils/progression';
import ContinueLearningHero from './mypage/ContinueLearningHero';
import NextCoachingPlan from './mypage/NextCoachingPlan';
import NextCoachingCardContainer from './mypage/NextCoachingCardContainer';
import RoadmapSection from './mypage/RoadmapSection';
import ProfileSummaryStrip from './mypage/ProfileSummaryStrip';
import StreakMiniCard from './mypage/StreakMiniCard';
import { Course } from '../types/mypage';
import { color, font, space } from '../theme/webcoachTheme';

const DESIGN_WIDTH = 1440;

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

  const noteStreakDays = useProgressionStore((s) => s.noteStreakDays);
  const { outerRef, innerRef, scale, innerHeight } = useScaleToFit(DESIGN_WIDTH);

  // 「学習中のコース」= 続きから(resumableCourse) + 受講中一覧。id重複は除外
  const learningCourses: Course[] = resumableCourse
    ? [resumableCourse, ...activeCourses.filter(c => c.id !== resumableCourse.id)]
    : activeCourses;

  // 学習時間は集中ブースの実測を正にする（取れなければ進捗率からの推定に落ちる）。
  // useMypageData の Promise.all には足さない（ブートをブロックしないため）。
  const { stats: studyStats, loading: studyStatsLoading } = useStudyStats(user?.userid);
  const learningSummary = useLearningSummary(learningCourses, studyStats);
  const primaryCourse = learningCourses[0];

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
          {/*
            構成は「広いメイン列＋狭い右レール」。主アクションは『続きからはじめる』の1つだけ。
            以前はカード9枚・データ点70個まで膨らみ、今週の学習時間やストリークが
            複数のカードに重複して出ていた。数字の置き場を1箇所に決め、
            詳しい内訳は /study-log・/learning-plan・/coaching に任せている。

            セクション見出しは各カードが内包する（NextCoachingCard と RoadmapSection は
            既に内部に見出しを持っているため、外に出すと二重になる）。
          */}
          <div className="home-rail">
            {/* メイン列: 誰か → いま再開できるもの → コーチングで決めた目標 */}
            <div className="flex flex-col" style={{ gap: space.sectionGap }}>
              <ProfileSummaryStrip
                name={avatarName}
                stats={studyStats}
                loading={studyStatsLoading}
                completedLessons={learningSummary.completedLessons.total}
              />
              {primaryCourse && (
                <ContinueLearningHero course={primaryCourse} onOpen={handleContinue} />
              )}
              <NextCoachingPlan userId={user?.userid} />
            </div>

            {/* 右レール: 続けるための小さな指標と、次回の予定 */}
            <div className="flex flex-col" style={{ gap: space.columnGap }}>
              <StreakMiniCard stats={studyStats} loading={studyStatsLoading} />
              <NextCoachingCardContainer userId={user?.userid} />
            </div>
          </div>

          {/* ロードマップは横幅があるほうが読めるので、2カラムの外に全幅で置く
              （PhaseTimeline がフェーズ数ぶんの列を組むため、狭いレールでは潰れる） */}
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
