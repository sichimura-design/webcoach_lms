import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';
import { AppFooter, AppHeader } from './shared';
import { useMypageData } from '../hooks/useMypageData';
import { useLearningSummary } from '../hooks/useLearningSummary';
import { useStudyStats } from '../hooks/useStudyStats';
import { useWeeklyGoal } from '../hooks/useWeeklyGoal';
import { useProgressionStore } from '../store/progressionStore';
import { useRecentCourseStore } from '../store/recentCourseStore';
import { EXP_RULES } from '../utils/progression';
import MypageGreeting from './mypage/MypageGreeting';
import ResumeStudyCard from './mypage/ResumeStudyCard';
import CoachingTaskCard from './mypage/CoachingTaskCard';
import StudyDashboardCard from './mypage/StudyDashboardCard';
import WeeklyGoalModal from './mypage/WeeklyGoalModal';
import { Course } from '../types/mypage';

/**
 * マイページ（ダッシュボード）。claude.ai/design『トップページ 3案』8a 準拠。
 *
 * 【レイアウト方式】
 * 🔴 useScaleToFit（1440px の固定キャンバスを transform:scale で縮小）は使わない。
 *    デザインが fr ベースの流動レイアウトになったため。scale 方式は狭い画面で
 *    文字まで一緒に縮んで読めなくなるのが難点で、こちらは素直に折り返す。
 *    学習コンテンツは今も scale 方式なので、あちらと作りが違う点に注意。
 *
 * 【構成】8a は「今やること」と「積み上がり」の2段構え
 *   ① 挨拶（日付＋名前＋きらめき。カードなし・地色に直置き）
 *   ② 上段2カラム: 左＝続きから学習、右＝次回コーチングまでのタスク
 *   ③ 下段1枚: 学習状況ダッシュボード（連続日数・総学習時間・修了レッスン数・
 *      今週の学習時間ゲージ・今週の目標グラフ）
 *   ④ フッター
 *
 * 🔴 8a で「学習時間チャレンジ」「みんなのランキング」を外した。
 *    順位の掘り下げは /study-log が受け持つ。5a に戻すときは
 *    StudyChallengeCard / PeerRankingCard / StreakHeroCard / StudyRecordCard を
 *    import し直すだけでよい（どれも mypage/ に残してある）。
 *
 * 🔴 AIコーチのFAB（右下）はこの画面が持っていない。全画面共通の AppHeader が
 *    GlobalAiCoachDrawer を出しているので、ここに足すと二重になる。
 *
 * 主アクション（塗りつぶしの赤ボタン）は ResumeStudyCard の
 * 『続きから学習する』1つだけ。他のカードのCTAはアウトラインかテキストリンクに
 * 留めること（DESIGN.md §15-5）。
 */

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
  /** 前回どのレッスンを開いたか。「続きから学習する」の飛び先に使う */
  const recentEntries = useRecentCourseStore((s) => s.entries);

  // 「学習中のコース」= 続きから(resumableCourse) + 受講中一覧。id重複は除外
  const learningCourses: Course[] = resumableCourse
    ? [resumableCourse, ...activeCourses.filter(c => c.id !== resumableCourse.id)]
    : activeCourses;

  // 学習時間は集中ブースの実測を正にする（取れなければ進捗率からの推定に落ちる）。
  // useMypageData の Promise.all には足さない（ブートをブロックしないため）。
  const { stats: studyStats, loading: studyStatsLoading } = useStudyStats(user?.userid);
  const learningSummary = useLearningSummary(learningCourses, studyStats);
  const primaryCourse = learningCourses[0];

  // 今週の学習時間の目標（8a）。プロフィールに持たせている
  const { goalMinutes, saving: goalSaving, save: saveGoal } = useWeeklyGoal(
    user?.userid,
    userProfile?.weekly_target_minutes
  );
  const [goalOpen, setGoalOpen] = useState(false);

  // ストリークが新たに伸びたタイミングでEXPボーナスを1度だけ付与
  useEffect(() => {
    if (streak?.days !== undefined) {
      noteStreakDays(streak.days, EXP_RULES.STREAK_DAY_BONUS);
    }
  }, [streak?.days, noteStreakDays]);

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="mypage-3d min-h-screen flex items-center justify-center" style={{ background: 'var(--dc-bg)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: 'var(--dc-primary)' }}></div>
          <p style={{ color: 'var(--dc-text-muted)' }}>読み込み中...</p>
        </div>
      </div>
    );
  }

  // Moodle account not linked
  if (!user?.userid) {
    return (
      <div className="mypage-3d min-h-screen flex items-center justify-center" style={{ background: 'var(--dc-bg)' }}>
        <div className="text-center px-6">
          <p className="font-bold mb-2" style={{ color: 'var(--dc-text)' }}>セッションが切れました</p>
          <p className="text-sm mb-4" style={{ color: 'var(--dc-text-muted)' }}>
            再度ログインしてください。
          </p>
          <Button
            onClick={() => navigate('/login')}
            className="mt-2 rounded-xl px-6 py-2 border-0 text-white"
            style={{ background: 'var(--dc-primary)' }}
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
      <div className="mypage-3d min-h-screen flex items-center justify-center" style={{ background: 'var(--dc-bg)' }}>
        <div className="text-center">
          <p style={{ color: 'var(--dc-text-muted)' }}>{error || 'データの読み込みに失敗しました'}</p>
          <Button
            onClick={() => window.location.reload()}
            className="mt-4 rounded-xl px-6 py-2 border-0 text-white"
            style={{ background: 'var(--dc-primary)' }}
          >
            再読み込み
          </Button>
        </div>
      </div>
    );
  }

  const avatarName = userProfile.nick_name || '';
  /*
   * 「続きから学習する」は没入型レッスンへ直行、「レッスン全体を見る」はコース目次へ。
   * 🔴 ?module= を必ず付ける。付けないと useLessonDoc の既定＝目次の先頭レッスンが
   *    開くので、「続きから」と書いてあるのに毎回1本目に戻っていた。
   *    前回開いたレッスンは recentCourseStore が覚えている（同じ履歴を
   *    ResumeStudyHost の「前回の続き」カードも使うので、両方の行き先が一致する）。
   *    履歴が無いときだけコース既定の入口に落とす。
   */
  const openLesson = () => {
    if (!primaryCourse) return;
    const recent = recentEntries.find((e) => e.courseId === primaryCourse.id);
    navigate(
      recent?.lessonId
        ? `/course/${primaryCourse.id}?module=${recent.lessonId}`
        : `/course/${primaryCourse.id}`
    );
  };
  const openCurriculum = () => primaryCourse && navigate(`/course/${primaryCourse.id}/curriculum`);

  return (
    <div className="mypage-3d min-h-screen flex flex-col" style={{ background: 'var(--dc-bg)' }}>
      <AppHeader userName={avatarName} />

      <main
        className="dc-page-main flex flex-col"
        style={{ flex: 1, padding: 'var(--dc-sp-page-y) var(--dc-sp-page-x) calc(var(--dc-sp-page-y) * 0.8)', color: 'var(--dc-text)' }}
      >
        <MypageGreeting name={avatarName} />

        <div className="mypage-8a-grid">
          <ResumeStudyCard
            course={primaryCourse}
            onOpenLesson={openLesson}
            onOpenCurriculum={openCurriculum}
          />
          <CoachingTaskCard userId={user?.userid} />
        </div>

        <StudyDashboardCard
          stats={studyStats}
          loading={studyStatsLoading}
          completedLessons={learningSummary.completedLessons.total}
          completedLessonsDelta={learningSummary.completedLessons.weekDelta}
          goalMinutes={goalMinutes}
          onEditGoal={() => setGoalOpen(true)}
        />

        <WeeklyGoalModal
          open={goalOpen}
          value={goalMinutes}
          saving={goalSaving}
          onClose={() => setGoalOpen(false)}
          onSave={async (m) => {
            await saveGoal(m);
            setGoalOpen(false);
          }}
        />

        <AppFooter />
      </main>
    </div>
  );
}

export default MyPage;
