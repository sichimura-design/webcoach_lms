import { RefObject, useEffect } from 'react';

/**
 * 開いているメニュー／ポップオーバーを「外側クリック」と Esc で閉じる。
 *
 * 同じ effect が MyNotesPage（並び替え）・NoteCard（⋮）・NoteEditor（＋）に
 * 3回コピペされていたのを1本にした。マイノート改善案でメニューが4つ増えるので、
 * ここに寄せないと同じものが7つ並ぶ。
 *
 * mousedown で判定するのは、click だと開く操作の click 自身に反応して
 * 開いた瞬間に閉じてしまうため。
 */
export function useDismissable(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void
): void {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [ref, open, onClose]);
}

export default useDismissable;
