import { useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import {
  SUPPORT_MODE_LABEL,
  SupportMode,
  useLearningWorkspaceStore,
} from '../../store/learningWorkspaceStore';
import PanelResizer from './PanelResizer';

/**
 * 右：学習サポート。AIコーチとメモを上下に並べる。
 *
 * PCでは教材に重ねず、グリッドの1列として並列表示する（閉じると教材が右端まで広がる）。
 * 分割／AIのみ／メモのみの3モードと、上下比率のドラッグに対応する（要件§5）。
 */
interface SupportPanelProps {
  aiPane: React.ReactNode;
  memoPane: React.ReactNode;
  mobile?: boolean;
  onClose: () => void;
}

const MODES: SupportMode[] = ['split', 'ai', 'notes'];

export function SupportPanel({ aiPane, memoPane, mobile = false, onClose }: SupportPanelProps) {
  const supportMode = useLearningWorkspaceStore((s) => s.supportMode);
  const setSupportMode = useLearningWorkspaceStore((s) => s.setSupportMode);
  const splitPercent = useLearningWorkspaceStore((s) => s.splitPercent);
  const setSplitPercent = useLearningWorkspaceStore((s) => s.setSplitPercent);
  const setSupportWidth = useLearningWorkspaceStore((s) => s.setSupportWidth);

  const bodyRef = useRef<HTMLDivElement>(null);

  // 右端からの距離がそのままパネル幅。クランプはストア側で行う。
  const handleWidthDrag = useCallback(
    (e: PointerEvent | React.PointerEvent) => setSupportWidth(window.innerWidth - e.clientX),
    [setSupportWidth]
  );

  const handleSplitDrag = useCallback(
    (e: PointerEvent | React.PointerEvent) => {
      const rect = bodyRef.current?.getBoundingClientRect();
      if (!rect || rect.height === 0) return;
      setSplitPercent(((e.clientY - rect.top) / rect.height) * 100);
    },
    [setSplitPercent]
  );

  const showAi = supportMode !== 'notes';
  const showMemo = supportMode !== 'ai';

  return (
    <aside
      aria-label="学習サポート"
      className="flex flex-col"
      style={{
        position: 'relative',
        minWidth: 0,
        height: '100%',
        overflow: 'hidden',
        background: color.surface,
        borderLeft: `1px solid ${color.border}`,
      }}
    >
      {!mobile && (
        <PanelResizer orientation="vertical" onDrag={handleWidthDrag} label="学習サポートの幅を調整" />
      )}

      <div
        className="flex items-center"
        style={{ gap: 10, minHeight: 52, padding: '0 14px', borderBottom: `1px solid ${color.border}`, flexShrink: 0 }}
      >
        <strong style={{ ...font.rowTitle, color: color.text }}>学習サポート</strong>
        <div style={{ flex: 1 }} />

        <div role="tablist" aria-label="表示モード" className="flex" style={{ padding: 3, borderRadius: 10, background: color.hoverBg }}>
          {MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="tab"
              aria-selected={supportMode === mode}
              onClick={() => setSupportMode(mode)}
              style={{
                height: 28, padding: '0 10px', border: 0, borderRadius: 8,
                background: supportMode === mode ? color.surface : 'transparent',
                color: supportMode === mode ? color.text : color.textMuted,
                fontSize: 11, fontWeight: 700, cursor: 'pointer',
                boxShadow: supportMode === mode ? '0 2px 7px rgba(33,42,57,.08)' : 'none',
              }}
            >
              {SUPPORT_MODE_LABEL[mode]}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="学習サポートを閉じる"
          style={{
            width: 32, height: 32, display: 'grid', placeItems: 'center',
            border: `1px solid ${color.borderStrong}`, borderRadius: 9,
            background: color.surface, color: color.iconMuted, cursor: 'pointer', flexShrink: 0,
          }}
        >
          <X size={15} />
        </button>
      </div>

      <div ref={bodyRef} className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>
        {showAi && (
          <div style={{ minHeight: 0, flex: supportMode === 'split' ? `0 0 ${splitPercent}%` : '1 1 auto' }}>
            {aiPane}
          </div>
        )}

        {supportMode === 'split' && (
          <PanelResizer orientation="horizontal" onDrag={handleSplitDrag} label="AIとメモの比率を調整" />
        )}

        {showMemo && (
          <div style={{ minHeight: 0, flex: supportMode === 'split' ? `1 1 ${100 - splitPercent}%` : '1 1 auto' }}>
            {memoPane}
          </div>
        )}
      </div>
    </aside>
  );
}

export default SupportPanel;
