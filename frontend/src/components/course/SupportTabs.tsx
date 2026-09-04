import { useRef } from 'react';
import { Bot, StickyNote } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import { CHAT_FOCUS_RING } from '../chat';

/**
 * 教材ページ右サイドバーの「AIコーチ / メモ」タブ。
 *
 * 以前はただの button が2つ並んでいるだけで、支援技術にはタブとして
 * 伝わらず、Tab キーは両方を素通りしていた。
 * role="tablist" + aria-selected + roving tabindex（選択中だけ Tab の
 * 止まり位置にして、左右キーで移動）にしている。
 */
export type SupportTabKey = 'ai' | 'memo';

interface SupportTabsProps {
  tab: SupportTabKey;
  onChange: (tab: SupportTabKey) => void;
  /** メモが入っている教材ではメモ側に印を出す */
  hasNote?: boolean;
  panelIdPrefix: string;
}

const TABS: { key: SupportTabKey; label: string; Icon: typeof Bot }[] = [
  { key: 'ai', label: 'AIコーチ', Icon: Bot },
  { key: 'memo', label: 'メモ', Icon: StickyNote },
];

export function SupportTabs({ tab, onChange, hasNote, panelIdPrefix }: SupportTabsProps) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const move = (delta: number) => {
    const index = TABS.findIndex(t => t.key === tab);
    const next = TABS[(index + delta + TABS.length) % TABS.length];
    onChange(next.key);
    refs.current[next.key]?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      onChange(TABS[0].key);
      refs.current[TABS[0].key]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      const last = TABS[TABS.length - 1];
      onChange(last.key);
      refs.current[last.key]?.focus();
    }
  };

  return (
    <div
      role="tablist"
      aria-label="サポートの種類"
      onKeyDown={onKeyDown}
      className="flex items-center"
      style={{
        gap: 6,
        padding: '8px 12px',
        background: color.pageBg,
        borderBottom: `1px solid ${color.border}`,
        flexShrink: 0,
      }}
    >
      {TABS.map(({ key, label, Icon }) => {
        const active = key === tab;
        const showDot = key === 'memo' && hasNote;
        return (
          <button
            key={key}
            ref={el => {
              refs.current[key] = el;
            }}
            type="button"
            role="tab"
            id={`${panelIdPrefix}-tab-${key}`}
            aria-selected={active}
            aria-controls={`${panelIdPrefix}-panel-${key}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(key)}
            className={`inline-flex items-center ${CHAT_FOCUS_RING}`}
            style={{
              gap: 6,
              height: 28,
              padding: '0 12px',
              border: `1px solid ${active ? color.primaryBorder : 'transparent'}`,
              borderRadius: 999,
              background: active ? color.primaryTint : 'transparent',
              color: active ? color.primary : color.textMuted,
              fontSize: 11.5,
              fontWeight: 700,
              fontFamily: font.family,
              cursor: 'pointer',
            }}
          >
            <Icon size={13} style={{ color: active ? color.primary : color.iconMuted }} />
            {label}
            {showDot && (
              <>
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: color.primary,
                    flexShrink: 0,
                  }}
                />
                {/* 6pxの点は色でしか判別できないので、読み上げ用の言葉も置く */}
                <span className="sr-only">メモあり</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default SupportTabs;
