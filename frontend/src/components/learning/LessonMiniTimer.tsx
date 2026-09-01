import { Pause, Play, Square, Timer } from 'lucide-react';
import { color, font, radius } from '../../theme/webcoachTheme';
import { useStudyTimerStore } from '../../store/studyTimerStore';
import { useStudySession } from '../../hooks/useStudySession';
import { useAuth } from '../../contexts/AuthContext';
import { formatMMSS } from '../../utils/studyStats';

/**
 * レッスンページのトップバーに置く、記録中の表示。
 *
 * LessonTopBar に ReactNode のスロットを開けず、自分でストアを読む自己完結型にしている。
 * 既存の props がすべてフラットな値型なので、スロットにすると
 * LearningWorkspacePage（500行超）にタイマーの状態を持ち込むことになるため。
 *
 * 🔴 表示専用。開始は StudySessionHost の打診ポップに一本化した。
 *    この画面は AppHeader（サイドバー）を描かない＝サイドバーの
 *    SidebarStudyTimer が出ないので、計測中であることを見せる役はここが担う。
 *
 * 終了はカードを開くだけ（App直下の StudySessionFinishHost が描く）。
 */
interface LessonMiniTimerProps {
  /** 別のレッスンで計測中かを見分けるため。表示の文言にしか使わない */
  courseId?: number;
}

const miniIconButton: React.CSSProperties = {
  width: 28,
  height: 28,
  display: 'grid',
  placeItems: 'center',
  border: 'none',
  borderRadius: 8,
  background: color.surface,
  color: color.textMuted,
  cursor: 'pointer',
  flexShrink: 0,
};

export function LessonMiniTimer({ courseId }: LessonMiniTimerProps) {
  const { user } = useAuth();
  const session = useStudyTimerStore((s) => s.session);
  const { elapsedSeconds, running, reachedTarget, pause, resume, prepareFinish } =
    useStudySession(user?.userid);

  /*
   * 未開始のときは何も描かない。
   * 🔴 ここに「集中して学習する」CTA は置かない。開始の入口は
   *    StudySessionHost の打診ポップ1つに集約した。入口が2つあると
   *    「押していないのに記録が始まった／押したのに始まらない」が混ざる。
   *    教材画面のトップバーは「出口と現在地だけ」に絞る方針でもある。
   */
  if (!session) return null;

  // ---- 稼働中 ----
  const otherMaterial = session.courseId !== undefined && session.courseId !== courseId;

  return (
    <div
      title={
        otherMaterial
          ? `別のレッスン（${session.courseTitle}）で学習中`
          : reachedTarget
            ? '目標時間に到達しました'
            : '集中して学習中'
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        minHeight: 38,
        padding: '0 5px 0 11px',
        /*
         * 🔴 稼働中/停止中はピル全体の色で見せる。
         *    以前は 13px の ‖ と ▷ の形の違いだけが手がかりで（地色は常にピンク）、
         *    止まっているのか動いているのかがひと目で読めなかった。
         */
        border: `1px solid ${running ? color.primaryBorder : color.borderNeutral}`,
        borderRadius: radius.nav,
        background: running ? color.primaryTint : color.stepFutureBg,
        flex: '0 0 auto',
      }}
    >
      <Timer size={14} style={{ color: running ? color.primary : color.textSubtle }} />
      <span
        style={{
          ...font.rowTitle,
          color: running ? color.primary : color.textSubtle,
          fontVariantNumeric: 'tabular-nums',
          minWidth: 46,
          textAlign: 'center',
        }}
      >
        {formatMMSS(elapsedSeconds)}
      </span>
      {/*
        トグルは「いまの状態」ではなく「押すと何が起きるか」を色で示す。
        停止中は塗り（押せば再開する）、稼働中は素の白（押せば止まる）。
        🔴 停止ボタンの赤はここへ譲って textMuted にした。淡い再生ボタンの隣に
           赤い■が並ぶと、再生側が無効に見えてしまうため。
      */}
      <button
        type="button"
        onClick={running ? pause : resume}
        aria-label={running ? '一時停止' : '再開'}
        title={running ? '一時停止' : '再開'}
        className="hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={
          running
            ? miniIconButton
            : { ...miniIconButton, background: color.primary, color: color.textOnPrimary }
        }
      >
        {running ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}
      </button>
      <button
        type="button"
        onClick={prepareFinish}
        aria-label="学習を終了して記録する"
        title="終了して記録する"
        className="hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={miniIconButton}
      >
        <Square size={12} />
      </button>
    </div>
  );
}

export default LessonMiniTimer;
