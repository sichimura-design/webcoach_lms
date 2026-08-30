import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AppHeader } from './shared';
import { useStudySession } from '../hooks/useStudySession';
import { useStudyStatsBundle } from '../hooks/useStudyStats';
import { useScaleToFit } from '../hooks/useScaleToFit';
import { StudySessionMode } from '../types/studyRoom';
import { StudyFinishDraft } from '../types/studyActivity';
import { color, font, space } from '../theme/webcoachTheme';
import FocusTimerCard from './focus/FocusTimerCard';
import StudyStatsCard from './focus/StudyStatsCard';
import StreakCalendarCard from './focus/StreakCalendarCard';
import RecentSessionsCard from './focus/RecentSessionsCard';
import RankingCard from './focus/RankingCard';
import FinishSessionModal from './focus/FinishSessionModal';
import { formatTodayLabel } from './focus/focusFormat';

const DESIGN_WIDTH = 1440;

/**
 * 集中ブース。学習を始めるきっかけ・学習時間/継続状況の可視化を担う画面。
 *   左  : タイマー(通常／ポモドーロ)＋開始・一時停止・終了
 *   右上: 今日/今週/ストリーク/累計の学習時間サマリー
 *   右中: 学習の継続(カレンダー)
 *   右下: 最近の学習記録
 *
 * レイアウトは他ページと同じ「固定1440pxで組んでtransform:scaleで縮小する」方式。
 * モーダル(FinishSessionModal)は<main ref={innerRef}>の外に置く
 * (transform:scaledされた要素の内側だとposition:fixedがビューポート基準にならないため)。
 */
function FocusBoothPage() {
  const { user } = useAuth();
  const { outerRef, innerRef, scale, innerHeight } = useScaleToFit(DESIGN_WIDTH);

  const {
    session,
    elapsedSeconds,
    running,
    reachedTarget,
    stale,
    start,
    pause,
    resume,
    discard,
    prepareFinish,
    cancelFinish,
    commitFinish,
    finishDraft,
  } = useStudySession(user?.userid);

  const { stats, streak, recent, ranking, calendarDays, calendarYear, calendarMonth, setCalendarMonth, loading, refresh } =
    useStudyStatsBundle(user?.userid);

  // 開始前の設定。開始したらsession側が正になる
  const [mode, setMode] = useState<StudySessionMode>('freeform');
  const [targetMinutes, setTargetMinutes] = useState(25);

  const handleStart = () => {
    // dev/kanegae統合: 実API呼び出しは useStudySession 内で非同期(fire-and-forget)に
    // 送信されるようになり、開始操作そのものは同期で完了する（starting状態は不要）。
    // category はページ専用のカテゴリが無いため、集中ブースは一律 'other' 扱いにする。
    start({ mode, targetMinutes, category: 'other' });
  };

  const handleCommit = async (patch: Partial<StudyFinishDraft>) => {
    await commitFinish(patch);
    refresh();
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: color.pageBg }}>
      <AppHeader userName={user?.username || 'User'} />

      <div className="relative flex-1">
        <div
          ref={outerRef}
          style={{
            width: '100%',
            maxWidth: DESIGN_WIDTH,
            margin: '0 auto',
            position: 'relative',
            height: innerHeight ? innerHeight * scale : undefined,
          }}
        >
          <main
            ref={innerRef}
            className="focus-main flex flex-col"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: DESIGN_WIDTH,
              boxSizing: 'border-box',
              padding: '28px 32px 40px',
              gap: space.sectionGap,
              fontFamily: font.family,
              color: color.text,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <h1 style={{ ...font.sectionTitle, fontSize: 22, color: color.text, margin: 0 }}>集中ブース</h1>
              <span style={{ ...font.caption, color: color.textSubtle }}>{formatTodayLabel(new Date())}</span>
            </div>

            <div className="flex" style={{ gap: space.columnGap, alignItems: 'flex-start' }}>
              <div style={{ flex: '0 0 480px' }}>
                <FocusTimerCard
                  session={session}
                  elapsedSeconds={elapsedSeconds}
                  running={running}
                  reachedTarget={reachedTarget}
                  stale={stale}
                  starting={false}
                  onDiscard={discard}
                  mode={mode}
                  targetMinutes={targetMinutes}
                  onModeChange={setMode}
                  onTargetChange={setTargetMinutes}
                  onStart={handleStart}
                  onPause={pause}
                  onResume={resume}
                  onFinish={prepareFinish}
                />
              </div>

              <div className="flex flex-col" style={{ flex: 1, gap: space.columnGap }}>
                <StudyStatsCard stats={stats} streak={streak} loading={loading} />
                <StreakCalendarCard
                  streak={streak}
                  calendarDays={calendarDays}
                  calendarYear={calendarYear}
                  calendarMonth={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  loading={loading}
                />
                <RecentSessionsCard sessions={recent} loading={loading} />
                <RankingCard ranking={ranking} currentUserId={user?.userid} loading={loading} />
              </div>
            </div>
          </main>
        </div>
      </div>

      <footer className="h-10 flex items-center justify-center" style={{ background: '#2B2629' }}>
        <span className="text-[11.4px] font-bold text-white">2026 &copy; WEBCOACH</span>
      </footer>

      {finishDraft && (
        <FinishSessionModal
          draft={finishDraft}
          weekTotalMinutes={stats?.week_minutes ?? 0}
          streakDays={streak?.current_streak}
          onRecord={handleCommit}
          onDismiss={cancelFinish}
        />
      )}
    </div>
  );
}

export default FocusBoothPage;
