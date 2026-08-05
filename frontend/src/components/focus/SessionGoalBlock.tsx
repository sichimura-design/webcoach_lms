import { color, font, radius, t } from '../../theme/webcoachTheme';

/**
 * 今回の学習目標（任意）。
 * 🔴 入力必須にしない。未入力でもそのまま開始できることを本文で明示する。
 * 稼働中も編集できる（目標は途中で書き足せる）。
 */
interface SessionGoalBlockProps {
  value: string;
  onChange: (value: string) => void;
  editing: boolean;
  onToggleEditing: () => void;
}

export function SessionGoalBlock({
  value,
  onChange,
  editing,
  onToggleEditing,
}: SessionGoalBlockProps) {
  return (
    <div
      style={{
        background: color.primaryTint,
        border: `1px solid ${color.primaryBorder}`,
        borderRadius: radius.md,
        padding: '13px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ ...font.label, color: color.textSubtle }}>今回の学習目標（任意）</span>
        <button
          type="button"
          onClick={onToggleEditing}
          className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{ ...t.chip, border: 'none', cursor: 'pointer', flexShrink: 0 }}
        >
          {editing ? '閉じる' : value ? '編集' : '書く'}
        </button>
      </div>

      {editing ? (
        <textarea
          rows={2}
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="例）バナー制作の基礎を1章進める"
          style={{
            width: '100%',
            marginTop: 10,
            border: `1px solid ${color.border}`,
            borderRadius: radius.md,
            padding: 12,
            fontFamily: 'inherit',
            fontSize: 14,
            lineHeight: 1.8,
            color: color.text,
            background: color.surface,
            outline: 'none',
            boxSizing: 'border-box',
            resize: 'vertical',
          }}
        />
      ) : (
        <div
          style={{
            ...font.meta,
            color: value ? color.textBody : color.textFaint,
            marginTop: 8,
            lineHeight: 1.8,
          }}
        >
          {value || '未入力でもそのまま開始できます'}
        </div>
      )}
    </div>
  );
}

export default SessionGoalBlock;
