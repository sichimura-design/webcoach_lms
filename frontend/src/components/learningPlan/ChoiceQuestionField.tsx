/**
 * frontend/src/components/learningPlan/ChoiceQuestionField.tsx
 * 選択式の設問1問。初回質問ウィザードと月次チェックインで共用する。
 *
 * 自由記述を使わないのは意図的で、受講生の回答も、そこから生成される文言も
 * ぶれさせないため（docs 準拠: 自由記述を最小限にする）。
 */
import { ChoiceOption, ChoiceQuestion } from '../../types/learningPlan';
import { color, font, radius } from '../../theme/webcoachTheme';

type Value = string | number | boolean;

interface ChoiceQuestionFieldProps {
  question: ChoiceQuestion;
  /** single のときは単一値、multi のときは配列 */
  value: Value | Value[] | undefined;
  onChange: (next: Value | Value[]) => void;
  /** 1問1画面のウィザードでは大きめ、フォーム内では控えめにする */
  size?: 'large' | 'compact';
  /** 選択肢を横並びのグリッドにする（月・スキルなど数が多いもの） */
  columns?: number;
}

function isSelected(value: ChoiceQuestionFieldProps['value'], option: ChoiceOption): boolean {
  if (Array.isArray(value)) return value.includes(option.value);
  return value === option.value;
}

function ChoiceQuestionField({ question, value, onChange, size = 'large', columns }: ChoiceQuestionFieldProps) {
  const large = size === 'large';

  const handle = (option: ChoiceOption) => {
    if (question.kind === 'single') {
      onChange(option.value);
      return;
    }
    const current = Array.isArray(value) ? value : [];
    onChange(current.includes(option.value) ? current.filter((v) => v !== option.value) : [...current, option.value]);
  };

  return (
    <div>
      <div style={{ ...(large ? font.cardTitle : font.rowTitle), color: color.text }}>{question.title}</div>
      {question.help && (
        <div style={{ ...font.caption, color: color.textSubtle, marginTop: 7, lineHeight: 1.7 }}>{question.help}</div>
      )}

      <div
        style={{
          display: columns ? 'grid' : 'flex',
          gridTemplateColumns: columns ? `repeat(${columns}, 1fr)` : undefined,
          flexDirection: columns ? undefined : 'column',
          gap: 9,
          marginTop: large ? 20 : 12,
        }}
      >
        {question.options.map((option) => {
          const selected = isSelected(value, option);
          return (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => handle(option)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
                padding: large ? '15px 18px' : '11px 14px',
                borderRadius: radius.md,
                border: `1.5px solid ${selected ? color.primary : color.border}`,
                background: selected ? color.primarySoft : color.surface,
                color: selected ? color.primary : color.textStrong,
                fontSize: large ? 14.5 : 13,
                fontWeight: selected ? 700 : 500,
                transition: 'border-color 120ms ease, background 120ms ease',
              }}
            >
              <span
                style={{
                  width: 18, height: 18, flex: '0 0 18px',
                  borderRadius: question.kind === 'multi' ? 5 : '50%',
                  border: `2px solid ${selected ? color.primary : color.borderNeutral}`,
                  background: selected ? color.primary : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
                }}
              >
                {selected && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7" />
                  </svg>
                )}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block' }}>{option.label}</span>
                {option.note && (
                  <span style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: selected ? color.primary : color.textFaint, marginTop: 3 }}>
                    {option.note}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ChoiceQuestionField;
