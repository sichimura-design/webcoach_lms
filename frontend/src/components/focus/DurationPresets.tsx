import { useState } from 'react';
import { color, font, radius } from '../../theme/webcoachTheme';

/**
 * ポモドーロの設定時間。25分・50分・カスタム。
 * カスタムを選ぶとその場に数値入力が出る（別画面に飛ばさない）。
 */
interface DurationPresetsProps {
  value: number;
  onChange: (minutes: number) => void;
  disabled?: boolean;
}

const PRESETS = [25, 50];
const MIN = 1;
const MAX = 300;

export function DurationPresets({ value, onChange, disabled }: DurationPresetsProps) {
  const isPreset = PRESETS.includes(value);
  const [customOpen, setCustomOpen] = useState(!isPreset);

  const buttonStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    border: `1px solid ${active ? color.primary : color.borderSoft}`,
    borderRadius: radius.sm,
    padding: '10px 0',
    background: active ? color.primary : color.surface,
    color: active ? color.textOnPrimary : color.textStrong,
    fontFamily: 'inherit',
    ...font.buttonSm,
    cursor: disabled ? 'not-allowed' : 'pointer',
  });

  return (
    <div style={{ opacity: disabled ? 0.5 : 1 }}>
      <div style={{ ...font.label, color: color.textSubtle, marginBottom: 8 }}>集中する時間</div>
      <div style={{ display: 'flex', gap: 8 }}>
        {PRESETS.map((min) => (
          <button
            key={min}
            type="button"
            disabled={disabled}
            aria-pressed={!customOpen && value === min}
            onClick={() => {
              setCustomOpen(false);
              onChange(min);
            }}
            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={buttonStyle(!customOpen && value === min)}
          >
            {min}分
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          aria-pressed={customOpen}
          onClick={() => setCustomOpen(true)}
          className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={buttonStyle(customOpen)}
        >
          カスタム
        </button>
      </div>

      {customOpen && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <input
            type="number"
            min={MIN}
            max={MAX}
            inputMode="numeric"
            disabled={disabled}
            value={value}
            onChange={(e) => onChange(Math.min(MAX, Math.max(MIN, Number(e.target.value) || MIN)))}
            style={{
              width: 88,
              textAlign: 'center',
              border: `1px solid ${color.border}`,
              borderRadius: radius.md,
              padding: '9px 8px',
              fontFamily: 'inherit',
              fontSize: 15,
              fontWeight: 700,
              color: color.text,
              outline: 'none',
              boxSizing: 'border-box',
              fontVariantNumeric: 'tabular-nums',
            }}
          />
          <span style={{ ...font.label, color: color.textSubtle }}>分で集中する</span>
        </div>
      )}
    </div>
  );
}

export default DurationPresets;
