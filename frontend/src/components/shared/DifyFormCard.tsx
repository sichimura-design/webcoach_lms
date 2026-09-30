/**
 * Dify の「フォーム付き」応答を、実際に入力して送れるフォームとして描く（B-016）。
 *
 * 🔴 送信する文字列は Dify 標準のチャットUIと同じ形にする（serializeDifyForm）。
 *    Dify アプリ側のフローはこの形で届く前提で次のステップへ進むため、
 *    見出しを付け足したり言い換えたりしない。
 * 🔴 1度送ったフォームは閉じる。同じ内容の二重送信で Dify の会話が1ターン余分に進むのを防ぐ。
 *    送信済みの印はこのコンポーネントの state なので、開き直すと消える。そのため呼び出し側が
 *    「最新の回答のフォームか」を stale で渡し、過去のフォームは送れなくする（A-3）。
 */
import { FormEvent, useState } from 'react';
import { color, radius } from '../../theme/webcoachTheme';
import { DifyForm, serializeDifyForm } from '../../utils/difyButtons';

interface DifyFormCardProps {
  form: DifyForm;
  disabled?: boolean;
  /** 最新の回答ではない（この入力は終わっている） */
  stale?: boolean;
  onSubmit: (message: string) => void;
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

export default function DifyFormCard({ form, disabled = false, stale = false, onSubmit }: DifyFormCardProps) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() =>
    Object.fromEntries(
      form.fields.map((f) => [f.name, f.kind === 'checkbox' ? f.defaultValue === 'true' : f.defaultValue]),
    ),
  );
  const [sent, setSent] = useState(false);

  const set = (name: string, v: string | boolean) => setValues((prev) => ({ ...prev, [name]: v }));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (disabled || stale || sent) return;
    setSent(true);
    onSubmit(serializeDifyForm(form, values));
  };

  const locked = disabled || stale || sent;

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'grid',
        gap: 12,
        marginTop: 8,
        padding: 14,
        border: `1px solid ${color.border}`,
        borderRadius: radius.md,
        background: color.pageBg,
      }}
    >
      {form.fields.map((f, i) => {
        if (f.kind === 'hidden') return null;
        const id = `dify-f-${i}-${f.name}`;
        if (f.kind === 'checkbox') {
          return (
            <label key={id} htmlFor={id} className="inline-flex items-center" style={{ gap: 8, fontSize: 12.5, color: color.text }}>
              <input
                id={id}
                type="checkbox"
                checked={values[f.name] === true}
                disabled={locked}
                onChange={(e) => set(f.name, e.target.checked)}
              />
              {f.label}
            </label>
          );
        }
        return (
          <div key={id} style={{ display: 'grid', gap: 4 }}>
            <label htmlFor={id} style={{ fontSize: 12, fontWeight: 700, color: color.text }}>
              {f.label}
            </label>
            {f.kind === 'textarea' ? (
              <textarea
                id={id}
                rows={f.rows}
                placeholder={f.placeholder}
                required={f.required}
                disabled={locked}
                value={String(values[f.name] ?? '')}
                onChange={(e) => set(f.name, e.target.value)}
                style={{ ...fieldStyle, resize: 'vertical' }}
              />
            ) : f.kind === 'select' ? (
              <select
                id={id}
                required={f.required}
                disabled={locked}
                value={String(values[f.name] ?? '')}
                onChange={(e) => set(f.name, e.target.value)}
                style={fieldStyle}
              >
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={id}
                type={f.inputType}
                placeholder={f.placeholder}
                required={f.required}
                disabled={locked}
                value={String(values[f.name] ?? '')}
                onChange={(e) => set(f.name, e.target.value)}
                style={fieldStyle}
              />
            )}
          </div>
        );
      })}
      <div>
        <button
          type="submit"
          disabled={locked}
          style={{
            border: 'none',
            borderRadius: 8,
            background: color.primary,
            color: color.textOnPrimary,
            padding: '9px 16px',
            fontFamily: 'inherit',
            fontSize: 12.5,
            fontWeight: 700,
            cursor: locked ? 'default' : 'pointer',
            opacity: locked ? 0.6 : 1,
          }}
        >
          {sent ? '送信しました' : stale ? 'この入力は終わっています' : form.submitLabel}
        </button>
      </div>
    </form>
  );
}
