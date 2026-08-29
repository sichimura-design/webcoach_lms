import { color, font } from '../../theme/webcoachTheme';
import { StudySessionMode } from '../../types/studyRoom';
import { formatHMS, formatMMSS } from './focusFormat';

/**
 * 円形タイマー(表示専用)。通常タイマーとポモドーロを1つの円で兼用する。
 * 通常タイマーには目標時間という分母が無いため、60秒で1周する秒針リングにする。
 */
export type DialState = 'idle' | 'running' | 'paused' | 'completed';

interface TimerDialProps {
  mode: StudySessionMode;
  elapsedSeconds: number;
  targetMinutes?: number;
  state: DialState;
  size?: number;
}

const DEFAULT_SIZE = 260;
const RING_WIDTH = 22;

export function TimerDial({ mode, elapsedSeconds, targetMinutes, state, size = DEFAULT_SIZE }: TimerDialProps) {
  const isPomodoro = mode === 'pomodoro' && !!targetMinutes;
  const total = (targetMinutes ?? 25) * 60;
  const remaining = Math.max(0, total - elapsedSeconds);
  const completed = state === 'completed';
  const inner = size - RING_WIDTH * 2;

  const deg = isPomodoro
    ? state === 'idle'
      ? 360
      : Math.round((remaining / total) * 360)
    : state === 'idle'
      ? 0
      : Math.round(((elapsedSeconds % 60) / 60) * 360);

  const ring = completed
    ? color.primary
    : `conic-gradient(${color.primary} 0 ${deg}deg, ${color.streakOff} ${deg}deg 360deg)`;

  const bigText = isPomodoro ? formatMMSS(remaining) : formatHMS(elapsedSeconds);

  const statusLabel =
    state === 'idle' ? 'タイマー未開始' : completed ? '目標達成！' : state === 'paused' ? '一時停止中' : '集中中';

  const caption = isPomodoro
    ? completed
      ? `+${formatMMSS(elapsedSeconds - total)} 超過`
      : `目標 ${targetMinutes}分`
    : targetMinutes
      ? `目安 ${targetMinutes}分 ・ 経過時間`
      : '経過時間';

  return (
    <div
      className="flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, borderRadius: '50%', background: ring, transition: 'background 500ms ease' }}
      role="timer"
      aria-label={`${statusLabel} ${bigText}`}
    >
      <div
        className="flex flex-col items-center justify-center"
        style={{
          width: inner,
          height: inner,
          borderRadius: '50%',
          background: color.surface,
          boxShadow: `inset 0 0 0 1px ${color.border}`,
          gap: 4,
        }}
      >
        <div style={{ ...font.chip, color: state === 'paused' ? color.textSubtle : color.primary }}>{statusLabel}</div>
        <div
          style={{
            fontSize: 46,
            fontWeight: 900,
            letterSpacing: '.02em',
            color: state === 'idle' ? color.textFaint : color.text,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {state === 'idle' && !isPomodoro ? '0:00' : bigText}
        </div>
        <div style={{ ...font.caption, color: color.textSubtle, maxWidth: inner - 40, textAlign: 'center' }}>
          {caption}
        </div>
      </div>
    </div>
  );
}

export default TimerDial;
