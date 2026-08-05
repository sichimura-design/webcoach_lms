import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import {
  AiSkillId,
  AI_SKILL_LABEL,
  AI_SKILL_MODE_LABEL,
  AI_SKILL_ORDER,
} from '../../types/aiSkill';

/**
 * AIコーチのモードセレクタ（仕様§7）。
 *
 * 通常はここを触らせない。既定は「おまかせ」で、内容に応じてAIコーチが提案する。
 * ただし目的が明確なユーザー（「文章を直したい」だけの人）に毎回提案を待たせるのは
 * 遠回りなので、直接指定できる口を1つ用意しておく。
 * だから見た目は控えめなピル1つに留め、選択肢を常時展開しない。
 */
interface SkillSelectorProps {
  value: AiSkillId;
  onChange: (skillId: AiSkillId) => void;
  disabled?: boolean;
}

export function SkillSelector({ value, onChange, disabled = false }: SkillSelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // 外側クリックと Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const active = value !== 'auto';

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="AIコーチのモードを選ぶ"
        className="inline-flex items-center disabled:opacity-50"
        style={{
          gap: 4,
          height: 26,
          padding: '0 9px',
          borderRadius: 999,
          border: `1px solid ${active ? color.primaryBorder : color.borderStrong}`,
          background: active ? color.primarySoft : color.surface,
          color: active ? color.primary : color.textMuted,
          fontSize: 10,
          fontWeight: 700,
          cursor: disabled ? 'default' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {AI_SKILL_MODE_LABEL[value]}
        <ChevronDown size={11} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 30,
            left: 0,
            zIndex: 60,
            minWidth: 208,
            padding: 5,
            border: `1px solid ${color.borderStrong}`,
            borderRadius: 11,
            background: color.surface,
            boxShadow: '0 16px 44px rgba(33,42,57,.18)',
          }}
        >
          {AI_SKILL_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={value === id}
              onClick={() => {
                onChange(id);
                setOpen(false);
              }}
              className="flex items-center"
              style={{
                gap: 7,
                width: '100%',
                padding: '7px 8px',
                border: 0,
                borderRadius: 8,
                background: value === id ? color.primaryTint : 'transparent',
                color: value === id ? color.primary : color.textBody,
                fontSize: 11.5,
                fontWeight: value === id ? 700 : 500,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span style={{ width: 12, flexShrink: 0 }}>
                {value === id && <Check size={12} />}
              </span>
              {AI_SKILL_LABEL[id]}
            </button>
          ))}
          <p
            style={{
              margin: '4px 8px 3px',
              ...font.caption,
              fontSize: 9.5,
              lineHeight: 1.6,
              color: color.textFaint,
            }}
          >
            おまかせのままでも、内容に応じて適したモードを提案します。
          </p>
        </div>
      )}
    </div>
  );
}

export default SkillSelector;
