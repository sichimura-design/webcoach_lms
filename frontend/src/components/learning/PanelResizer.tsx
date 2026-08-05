import { useCallback, useRef, useState } from 'react';
import { color } from '../../theme/webcoachTheme';

/**
 * パネルのドラッグリサイザ。
 *
 * react-resizable-panels は入れず、pointer capture で自前実装する。
 * 用途が2箇所（右パネルの幅・AI/メモの上下比率）しかなく、依存を増やす理由がないため。
 *
 * onDrag には「そのポインタ位置」をそのまま渡す。px→幅、y→% の変換は
 * 呼び出し側が担当する（可動域のクランプはストア側で行う）。
 */
interface PanelResizerProps {
  orientation: 'vertical' | 'horizontal';
  onDrag: (event: PointerEvent | React.PointerEvent) => void;
  onDragEnd?: () => void;
  label: string;
  /** 有効/無効。分割モード以外では上下スプリッタを無効にする */
  disabled?: boolean;
}

export function PanelResizer({ orientation, onDrag, onDragEnd, label, disabled = false }: PanelResizerProps) {
  const [dragging, setDragging] = useState(false);
  const activeRef = useRef(false);
  const isVertical = orientation === 'vertical';

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      activeRef.current = true;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      // ドラッグ中に本文が選択されると選択ツールバーが誤爆する
      document.body.style.userSelect = 'none';
    },
    [disabled]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!activeRef.current) return;
      onDrag(e);
    },
    [onDrag]
  );

  const stop = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    setDragging(false);
    document.body.style.userSelect = '';
    onDragEnd?.();
  }, [onDragEnd]);

  if (disabled) return null;

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={isVertical ? 'vertical' : 'horizontal'}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      style={{
        position: isVertical ? 'absolute' : 'relative',
        ...(isVertical
          ? { left: -5, top: 0, bottom: 0, width: 10, zIndex: 5 }
          : { height: 8, width: '100%' }),
        cursor: isVertical ? 'col-resize' : 'row-resize',
        touchAction: 'none',
        background: isVertical ? 'transparent' : color.hoverBg,
        borderTop: isVertical ? undefined : `1px solid ${color.border}`,
        borderBottom: isVertical ? undefined : `1px solid ${color.border}`,
        flexShrink: 0,
      }}
    >
      {/* 掴めることが分かる程度の細いインジケータ */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          ...(isVertical
            ? { left: 4, top: 0, bottom: 0, width: 2 }
            : { top: 3, left: '50%', transform: 'translateX(-50%)', width: 34, height: 2, borderRadius: 999 }),
          background: dragging ? color.primary : isVertical ? 'transparent' : '#C8CED7',
          transition: 'background .18s ease',
        }}
      />
    </div>
  );
}

export default PanelResizer;
