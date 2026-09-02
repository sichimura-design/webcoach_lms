import { useEffect, useRef, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import {
  AiSkillId,
  AI_SKILL_CATEGORY_LABEL,
  AI_SKILL_CATEGORY_ORDER,
  AI_SKILL_LABEL,
  AI_SKILL_MODE_LABEL,
  skillsInCategory,
} from '../../types/aiSkill';

/**
 * AIアプリ（モード）の選択口。入力欄の「＋」1つに集約したもの。
 *
 * 🔴 かつてはヘッダーの `おまかせ ▾` ピル（SkillSelector）と、入力欄の上の
 *    機能一覧（AiSkillDock）の2つがあり、さらにヘッダー自体が器のバーと二重だった。
 *    「押せるところ・選べるものが多すぎる」というレビュー指摘で、
 *    **選択口はこの＋ボタン1つだけ**に統合した。
 *
 * 通常はここを触らせない。既定は「おまかせ」で、内容に応じてAIコーチが提案する。
 * ただし目的が明確なユーザー（「文章を直したい」だけの人）に毎回提案を待たせるのは
 * 遠回りなので、直接指定できる口を1つ残しておく。だからラベルを持たないアイコンにする。
 *
 * 🔴 既定ではリストを**上**へ開く。この＋は画面下端の入力欄にあるので、下に開くと切れる。
 *    AI専用ページのホームだけは入力欄がページ上部にあるので down を渡す。
 */
interface SkillPlusMenuProps {
  value: AiSkillId;
  onChange: (skillId: AiSkillId) => void;
  disabled?: boolean;
  /** リストを開く向き。既定は上（会話画面の入力欄は画面下端にあるため） */
  direction?: 'up' | 'down';
}

export function SkillPlusMenu({
  value,
  onChange,
  disabled = false,
  direction = 'up',
}: SkillPlusMenuProps) {
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

  const renderOption = (id: AiSkillId) => (
    <button
      key={id}
      type="button"
      role="option"
      aria-selected={value === id}
      onClick={() => {
        onChange(id);
        setOpen(false);
      }}
      className="wc-ai-menu-item flex items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{
        gap: 7,
        width: '100%',
        padding: '7px 8px',
        border: 0,
        borderRadius: 8,
        background: value === id ? color.primaryTint : 'transparent',
        color: value === id ? color.primary : color.textBody,
        fontFamily: 'inherit',
        fontSize: 11.5,
        fontWeight: value === id ? 700 : 500,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span style={{ width: 12, flexShrink: 0 }}>{value === id && <Check size={12} />}</span>
      {AI_SKILL_LABEL[id]}
    </button>
  );

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        // ラベルを持たないので、いまのモードは読み上げとツールチップで伝える
        aria-label={
          active ? `AIアプリを選ぶ（いま: ${AI_SKILL_MODE_LABEL[value]}）` : 'AIアプリを選ぶ'
        }
        title={active ? `${AI_SKILL_MODE_LABEL[value]}（AIアプリを選ぶ）` : 'AIアプリを選ぶ'}
        className="wc-ai-icon-btn grid place-items-center disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          width: 30,
          height: 30,
          border: 0,
          borderRadius: 8,
          // 専門モードに入っているあいだだけ色を持たせる。
          // ラベルが無いので、色が唯一の「いま切り替わっている」印になる。
          background: active ? color.primarySoft : color.hoverBg,
          color: active ? color.primary : color.iconMuted,
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        <Plus size={16} />
      </button>

      {open && (
        <div
          role="listbox"
          className="wc-ai-menu"
          style={{
            position: 'absolute',
            ...(direction === 'up' ? { bottom: 36 } : { top: 36 }),
            left: 0,
            zIndex: 60,
            minWidth: 224,
            maxHeight: 'min(340px, 50vh)',
            overflowY: 'auto',
            padding: 5,
            border: `1px solid ${color.borderStrong}`,
            borderRadius: 11,
            background: color.surface,
            boxShadow: '0 16px 44px rgba(33,42,57,.18)',
          }}
        >
          {/* 'auto' を先頭に固定し、実スキルは目的（学習／制作／キャリア）で束ねる。
              機能が増えたのでフラットに並べると探せなくなる。 */}
          {renderOption('auto')}
          {AI_SKILL_CATEGORY_ORDER.map((category) => (
            <div key={category}>
              <p
                style={{
                  margin: '5px 8px 2px',
                  fontSize: 9,
                  fontWeight: 800,
                  letterSpacing: '.06em',
                  color: color.textFaint,
                }}
              >
                {AI_SKILL_CATEGORY_LABEL[category]}
              </p>
              {skillsInCategory(category).map(renderOption)}
            </div>
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

export default SkillPlusMenu;
