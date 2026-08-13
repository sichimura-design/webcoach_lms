import { X } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';

/**
 * AI／メモのオーバーレイ。
 *
 * 以前はレイアウトの「列」で、目次・本文・サポートの3ペインが常に幅を取り合っていた。
 * 上下分割（split）モードまであり、本文が最も狭くなる状態が既定になり得た。
 * いまは本文が唯一の常設要素で、ここは右下のピルから開いたときだけ本文の上に重なる。
 *
 * 🔴 AiCoachPane / MemoPane の中身は一切変更していない。
 *    ここは器だけを差し替える改修で、AI・メモの機能自体は元のまま動く。
 */
export type SupportTab = 'ai' | 'notes';

interface SupportPanelProps {
  tab: SupportTab;
  onTabChange: (tab: SupportTab) => void;
  onClose: () => void;
  aiPane: React.ReactNode;
  memoPane: React.ReactNode;
}

const TABS: { key: SupportTab; label: string }[] = [
  { key: 'ai', label: 'AIコーチ' },
  { key: 'notes', label: 'メモ' },
];

export function SupportPanel({ tab, onTabChange, onClose, aiPane, memoPane }: SupportPanelProps) {
  return (
    <>
      {/* 背景クリックで閉じる。本文を見たいだけのときに閉じ方を探させない */}
      <div
        role="presentation"
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(28,34,44,.22)' }}
      />

      <aside
        className="wc-lesson-support"
        role="dialog"
        aria-label="AIコーチとメモ"
        style={{
          position: 'fixed',
          zIndex: 71,
          background: color.surface,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div
          className="flex items-center"
          style={{
            gap: 6,
            minHeight: 48,
            padding: '0 8px 0 12px',
            borderBottom: `1px solid ${color.border}`,
            flexShrink: 0,
          }}
        >
          <div role="tablist" aria-label="サポートの種類" style={{ display: 'flex', gap: 4 }}>
            {TABS.map((t) => {
              const active = t.key === tab;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onTabChange(t.key)}
                  className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  style={{
                    height: 32,
                    padding: '0 14px',
                    border: `1px solid ${active ? color.primaryBorder : 'transparent'}`,
                    borderRadius: 999,
                    background: active ? color.primarySoft : 'transparent',
                    color: active ? color.primary : color.textMuted,
                    fontFamily: 'inherit',
                    ...font.chip,
                    cursor: 'pointer',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div style={{ flex: 1 }} />

          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="grid place-items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              width: 30,
              height: 30,
              border: 0,
              borderRadius: 8,
              background: 'transparent',
              color: color.iconMuted,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* 両方マウントしたままにすると AiCoachPane の会話状態が保たれる。
            タブを行き来しただけで入力中の内容が消えるのを避ける。 */}
        <div style={{ flex: 1, minHeight: 0, display: tab === 'ai' ? 'flex' : 'none', flexDirection: 'column' }}>
          {aiPane}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: tab === 'notes' ? 'flex' : 'none', flexDirection: 'column' }}>
          {memoPane}
        </div>
      </aside>
    </>
  );
}

export default SupportPanel;
