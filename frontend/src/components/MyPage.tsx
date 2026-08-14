import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';
import { useAuth } from '../contexts/AuthContext';
import { AppHeader } from './shared';
import { useMypageData } from '../hooks/useMypageData';
import { useLearningSummary } from '../hooks/useLearningSummary';
import { useStudyStats } from '../hooks/useStudyStats';
import { useProgressionStore } from '../store/progressionStore';
import { EXP_RULES } from '../utils/progression';
import MypageGreeting from './mypage/MypageGreeting';
import RoadmapStrip from './mypage/RoadmapStrip';
import ContinueLearningHero from './mypage/ContinueLearningHero';
import LearningStreakCard from './mypage/LearningStreakCard';
import NextCoachingPlan from './mypage/NextCoachingPlan';
import NextCoachingCardContainer from './mypage/NextCoachingCardContainer';
import { Course } from '../types/mypage';

/**
 * マイページ（ダッシュボード）。claude.ai/design『マイページ 3d.dc.html』準拠。
 *
 * 【レイアウト方式】
 * 🔴 useScaleToFit（1440px の固定キャンバスを transform:scale で縮小）は使わない。
 *    デザインが fr ベースの流動レイアウトになったため。scale 方式は狭い画面で
 *    文字まで一緒に縮んで読めなくなるのが難点で、こちらは素直に折り返す。
 *    自習室・学習コンテンツは今も scale 方式なので、あちらと作りが違う点に注意。
 *
 * 【構成】
 *   ① 挨拶 + 統計（カードなし・地色に直置き）
 *   ② 学習ロードマップの横型帯
 *   ③ 2カラム: 左＝続きを学ぶ / 継続記録、右＝次回コーチング / 目標
 *   ④ フッター
 *
 * 主アクション（塗りつぶしの赤ボタン）は『続きから学習する』の1つだけ。
 * 他のカードのCTAはアウトラインかテキストリンクに留めること（DESIGN.md §15-5）。
 */

/** セクションの小見出し（Eyebrow）。DESIGN.md §3 の 13px/700/letter-spacing .08em */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--dc-text-muted)', letterSpacing: '.08em', paddingLeft: 4 }}>
      {children}
    </div>
  );
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

  const noteStreakDays = useProgressionStore((s) => s.noteStreakDays);

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
  // 「続きから学習する」は没入型レッスンへ直行、「レッスン全体を見る」はコース目次へ
  const openLesson = () => primaryCourse && navigate(`/course/${primaryCourse.id}`);
  const openCurriculum = () => primaryCourse && navigate(`/course/${primaryCourse.id}/curriculum`);

  return (
    <div className="mypage-3d min-h-screen flex flex-col" style={{ background: 'var(--dc-bg)' }}>
      <AppHeader userName={avatarName} />

      <main
        className="flex flex-col"
        style={{ flex: 1, padding: '32px 28px 20px', color: 'var(--dc-text)' }}
      >
        <MypageGreeting
          name={avatarName}
          stats={studyStats}
          loading={studyStatsLoading}
          completedLessons={learningSummary.completedLessons.total}
        />

        <RoadmapStrip userId={user?.userid} />

        <div className="mypage-3d-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Eyebrow>続きを学ぶ</Eyebrow>
            {primaryCourse && (
              <ContinueLearningHero
                course={primaryCourse}
                onOpen={openLesson}
                onOpenCurriculum={openCurriculum}
              />
            )}

            <Eyebrow>継続記録</Eyebrow>
            <LearningStreakCard stats={studyStats} loading={studyStatsLoading} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Eyebrow>コーチと学ぶ</Eyebrow>
            {/* 読み込み中と「次回の予定なし」のときは null を返す。
                縦積みなので、消えても下のカードが繰り上がるだけで崩れない
                （2×2グリッド時代はセルの位置を明示する必要があった） */}
            <NextCoachingCardContainer userId={user?.userid} />
            <NextCoachingPlan userId={user?.userid} />
          </div>
        </div>

        <footer
          style={{ textAlign: 'center', fontSize: 12, color: 'var(--dc-text-subtle)', padding: '32px 0 0', marginTop: 'auto' }}
        >
          2026 &copy; WEBCOACH
        </footer>
      </main>
    </div>
  );
}

export default MyPage;
