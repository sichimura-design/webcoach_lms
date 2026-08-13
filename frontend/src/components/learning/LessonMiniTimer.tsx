import { Pause, Play, Square, Timer } from 'lucide-react';
import { color, font, radius } from '../../theme/webcoachTheme';
import { useStudyTimerStore } from '../../store/studyTimerStore';
import { useStudySession } from '../../hooks/useStudySession';
import { useAuth } from '../../contexts/AuthContext';
import { formatMMSS } from '../../utils/studyStats';

/**
 * レッスンページのトップバーに置くミニタイマー。
 *
 * LessonTopBar に ReactNode のスロットを開けず、自分でストアを読む自己完結型にしている。
 * 既存の props がすべてフラットな値型なので、スロットにすると
 * LearningWorkspacePage（500行超）にタイマーの状態を持ち込むことになるため。
 *
 * 未開始なら「集中して学習する」、稼働中なら経過時間＋一時停止／終了を、
 * 🔴 同じスロットで出し分ける（別の場所に置くと開始した瞬間に要素幅が動いて
 *    隣のボタンがズレる。同じスロットなら 38px 高が固定でレイアウトが揺れない）。
 *
 * 終了はカードを開くだけ（App直下の StudySessionFinishHost が描く）。
 */
interface LessonMiniTimerProps {
  courseId?: number;
  courseName?: string;
  lessonId?: number | null;
  lessonTitle?: string;
  /** レッスンの進捗（記録に残す） */
  progressPercent?: number;
  /**
   * 未開始のときは何も描かない。
   * 教材画面のトップバーは「出口と現在地だけ」に絞ったので、
   * 待機中の「集中して学習する」CTAがそこに常駐すると注意を奪ってしまう。
   * 稼働中は残す。この画面では FloatingStudyTimer が自分を隠すため、
   * ここを消すと計測中であることがどこにも出なくなる。
   */
  hideWhenIdle?: boolean;
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

export function LessonMiniTimer({
  courseId,
  courseName,
  lessonId,
  lessonTitle,
  progressPercent,
  hideWhenIdle,
}: LessonMiniTimerProps) {
  const { user } = useAuth();
  const session = useStudyTimerStore((s) => s.session);
  const { elapsedSeconds, running, reachedTarget, start, pause, resume, prepareFinish } =
    useStudySession(user?.userid);

  // ---- 未開始: このレッスンでそのまま開始する（モーダルは挟まない）----
  if (!session) {
    if (hideWhenIdle) return null;
    return (
      <button
        type="button"
        title="このレッスンで集中タイマーを開始する"
        onClick={() =>
          start({
            mode: 'freeform',
            targetMinutes: 25,
            courseId,
            courseTitle: courseName,
            lessonId: lessonId ?? undefined,
            lessonTitle,
            progressPercentAtStart: progressPercent,
          })
        }
        className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          minHeight: 38,
          padding: '0 13px',
          border: `1px solid ${color.primaryBorder}`,
          borderRadius: radius.nav,
          background: color.surface,
          color: color.primary,
          ...font.buttonSm,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flex: '0 0 auto',
        }}
      >
        <Timer size={15} />
        <span className="hidden lg:inline">集中して学習する</span>
      </button>
    );
  }

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
        border: `1px solid ${color.primaryBorder}`,
        borderRadius: radius.nav,
        background: color.primaryTint,
        flex: '0 0 auto',
      }}
    >
      <Timer size={14} style={{ color: color.primary, opacity: running ? 1 : 0.5 }} />
      <span
        style={{
          ...font.rowTitle,
          color: color.primary,
          fontVariantNumeric: 'tabular-nums',
          minWidth: 46,
          textAlign: 'center',
        }}
      >
        {formatMMSS(elapsedSeconds)}
      </span>
      <button
        type="button"
        onClick={running ? pause : resume}
        aria-label={running ? '一時停止' : '再開'}
        title={running ? '一時停止' : '再開'}
        className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={miniIconButton}
      >
        {running ? <Pause size={13} /> : <Play size={13} />}
      </button>
      <button
        type="button"
        onClick={prepareFinish}
        aria-label="学習を終了して記録する"
        title="終了して記録する"
        className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{ ...miniIconButton, color: color.primary }}
      >
        <Square size={12} />
      </button>
    </div>
  );
}

export default LessonMiniTimer;
