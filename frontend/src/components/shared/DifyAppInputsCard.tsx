/**
 * AIアプリの入口に添える開始前の入力欄（AI面接シミュレーターの求人URL等、ID 22）。
 *
 * 🔴 Dify標準画面では会話を始める前のフォームで入れる項目で、会話の中では尋ねられない。
 *    ここで受け取った値は、モードに入った最初の発言と一緒に app_inputs として送る（useLessonAi）。
 *    そのため値はこのコンポーネントの state ではなくセッション（AiCoachSession.appInputs）に持つ。
 * 🔴 ラベルは Dify 側の文（「求人情報のURLを入力してください」）をそのまま見せる。
 *    入力欄に添える前提で書かれた文なので、言い換えない。
 */
import { color, radius } from '../../theme/webcoachTheme';
import type { AiApplicationInputField } from '../../types/aiApplication';

interface DifyAppInputsCardProps {
  fields: AiApplicationInputField[];
  values: Record<string, string>;
  skipped: boolean;
  /** 最新の回答ではない、または生成中（もう入力は終わっている／いまは変えられない） */
  locked?: boolean;
  /** 必須が埋まるまで選択肢を押せないことを伝える（選択肢があるときだけ） */
  showHint?: boolean;
  onChange: (variable: string, value: string) => void;
  onSkip: (skipped: boolean) => void;
}

const fieldStyle = {
  width: '100%',
  boxSizing: 'border-box' as const,
  border: `1px solid ${color.border}`,
  borderRadius: 8,
  background: color.surface,
  padding: '8px 10px',
  fontFamily: 'inherit',
  fontSize: 12.5,
  lineHeight: 1.6,
  color: color.text,
};

/** 「URLなしで始める」等。必須項目がURLのときはそう書く */
export const skipLabelOf = (fields: AiApplicationInputField[]): string =>
  fields.some((f) => f.required && /URL/i.test(f.label)) ? 'URLなしで始める' : '入力せずに始める';

export default function DifyAppInputsCard({
  fields,
  values,
  skipped,
  locked = false,
  showHint = false,
  onChange,
  onSkip,
}: DifyAppInputsCardProps) {
  const hasRequired = fields.some((f) => f.required);
  const ready =
    skipped || fields.every((f) => !f.required || (values[f.variable] ?? '').trim() !== '');
  const skipLabel = skipLabelOf(fields);

  return (
    <div
      style={{
        display: 'grid',
        gap: 10,
        marginTop: 8,
        padding: 14,
        border: `1px solid ${color.border}`,
        borderRadius: radius.md,
        background: color.pageBg,
      }}
    >
      {fields.map((f) => {
        const id = `app-input-${f.variable}`;
        const fieldDisabled = locked || skipped;
        return (
          <div key={id} style={{ display: 'grid', gap: 4 }}>
            <label htmlFor={id} style={{ fontSize: 12, fontWeight: 700, color: color.text }}>
              {f.label}
              {f.required && <span style={{ marginLeft: 6, color: color.primary, fontSize: 11 }}>必須</span>}
            </label>
            {f.type === 'paragraph' ? (
              <textarea
                id={id}
                rows={3}
                disabled={fieldDisabled}
                maxLength={f.max_length ?? undefined}
                value={values[f.variable] ?? ''}
                onChange={(e) => onChange(f.variable, e.target.value)}
                style={{ ...fieldStyle, resize: 'vertical' }}
              />
            ) : f.type === 'select' ? (
              <select
                id={id}
                disabled={fieldDisabled}
                value={values[f.variable] ?? ''}
                onChange={(e) => onChange(f.variable, e.target.value)}
                style={fieldStyle}
              >
                <option value="">選んでください</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                type={f.type === 'number' ? 'number' : 'text'}
                inputMode={f.type === 'number' ? 'numeric' : 'url'}
                placeholder={/URL/i.test(f.label) ? 'https://' : undefined}
                disabled={fieldDisabled}
                maxLength={f.max_length ?? undefined}
                value={values[f.variable] ?? ''}
                onChange={(e) => onChange(f.variable, e.target.value)}
                style={fieldStyle}
              />
            )}
          </div>
        );
      })}
      {hasRequired && (
        <label className="inline-flex items-center" style={{ gap: 8, fontSize: 12, color: color.textBody }}>
          <input type="checkbox" checked={skipped} disabled={locked} onChange={(e) => onSkip(e.target.checked)} />
          {skipLabel}
        </label>
      )}
      {showHint && !locked && !ready && (
        <p style={{ margin: 0, fontSize: 11, lineHeight: 1.6, color: color.textMuted }}>
          入力するか「{skipLabel}」を選ぶと、下の選択肢を選べます。
        </p>
      )}
    </div>
  );
}
