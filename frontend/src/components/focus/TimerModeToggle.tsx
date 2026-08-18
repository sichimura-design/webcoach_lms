import { color, font, radius } from '../../theme/webcoachTheme';
import { STUDY_SESSION_MODE_LABEL, StudySessionMode } from '../../types/studyActivity';

/**
 * 通常タイマー／ポモドーロの切り替え。稼働中はdisabledにする(非表示ではなく無効化)。
 */
interface TimerModeToggleProps {
  value: StudySessionMode;
  onChange: (mode: StudySessionMode) => void;
  disabled?: boolean;
}

const MODES: StudySessionMode[] = ['freeform', 'pomodoro'];

export function TimerModeToggle({ value, onChange, disabled }: TimerModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="タイマーの種類"
      style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        background: color.pageBg,
        border: `1px solid ${color.border}`,
        borderRadius: radius.pill,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {MODES.map((m) => {
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            disabled={disabled}
            onClick={() => onChange(m)}
            aria-pressed={active}
            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              border: 'none',
              borderRadius: radius.pill,
              padding: '7px 16px',
              background: active ? color.primary : 'transparent',
              color: active ? color.textOnPrimary : color.textMuted,
              fontFamily: 'inherit',
              ...font.buttonSm,
              cursor: disabled ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {STUDY_SESSION_MODE_LABEL[m]}
          </button>
        );
      })}
    </div>
  );
}

export default TimerModeToggle;
