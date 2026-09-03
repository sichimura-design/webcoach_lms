import { RefObject, useEffect } from 'react';

/**
 * 開いているオーバーレイ／ポップオーバーを「外側クリック」と Esc で閉じる。
 *
 * mousedown で判定するのは、click だと開く操作の click 自身に反応して
 * 開いた瞬間に閉じてしまうため。
 *
 * @param capture Esc を capture フェーズで受け、伝播を止める。
 *   重ねて開いているとき（ドロワーの上の画像拡大表示など）、外側のオーバーレイの
 *   Esc ハンドラまで一緒に発火して2枚とも閉じるのを防ぐ。上に乗る側で true にする。
 */
export function useDismissable(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
  capture = false
): void {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (capture) e.stopPropagation();
      onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, capture);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, capture);
    };
  }, [ref, open, onClose, capture]);
}

export default useDismissable;
