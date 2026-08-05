import { RefObject, useCallback, useEffect, useState } from 'react';

/**
 * 教材本文のテキスト選択を捕まえるフック。
 *
 * 選択範囲そのものだけでなく、それが「どの教材ブロックの、どの位置か」まで解決する。
 * AIへ渡す文脈（選択文章の前後）とクリップの位置復元が、どちらもこの情報に乗る。
 *
 * ブロックの解決は DOM の data 属性に依存する。LessonBlockView が必ず
 * data-block-id / data-heading を付けること。
 */
export interface LessonSelection {
  text: string;
  /** 画面座標。ツールバーの表示位置に使う */
  rect: DOMRect;
  blockId: string;
  heading: string;
  /** ブロック内テキストでの開始オフセット。クリップの位置復元に使う */
  offset: number;
  contextBefore: string;
  contextAfter: string;
}

export interface UseTextSelection {
  selection: LessonSelection | null;
  clear: () => void;
}

const MIN_LENGTH = 2;
const MAX_LENGTH = 400;
const CONTEXT_CHARS = 200;

function elementOf(node: Node | null): HTMLElement | null {
  if (!node) return null;
  return node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
}

export function useTextSelection(
  articleRef: RefObject<HTMLElement>,
  enabled: boolean
): UseTextSelection {
  const [selection, setSelection] = useState<LessonSelection | null>(null);

  const clear = useCallback(() => setSelection(null), []);

  const capture = useCallback(() => {
    if (!enabled) return;
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? '';

    if (!sel || sel.rangeCount === 0 || text.length < MIN_LENGTH || text.length > MAX_LENGTH) {
      setSelection(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const block = elementOf(range.commonAncestorContainer)?.closest<HTMLElement>('[data-block-id]');
    if (!block || !articleRef.current?.contains(block)) {
      setSelection(null);
      return;
    }

    const blockText = block.textContent ?? '';
    const offset = blockText.indexOf(text);

    setSelection({
      text,
      rect: range.getBoundingClientRect(),
      blockId: block.dataset.blockId ?? '',
      heading: block.dataset.heading ?? '',
      offset: offset >= 0 ? offset : 0,
      contextBefore: offset > 0 ? blockText.slice(Math.max(0, offset - CONTEXT_CHARS), offset) : '',
      contextAfter:
        offset >= 0 ? blockText.slice(offset + text.length, offset + text.length + CONTEXT_CHARS) : '',
    });
  }, [articleRef, enabled]);

  useEffect(() => {
    if (!enabled) {
      setSelection(null);
      return;
    }

    const onMouseUp = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      // ツールバー・解説ポップオーバー・右パネル上のクリックでは選択を評価しない
      // （評価すると、ボタンを押した瞬間に選択が消えて操作できなくなる）
      if (target?.closest('[data-selection-ui]')) return;
      // 選択確定は mouseup の後に反映されるので1tick遅らせる
      window.setTimeout(capture, 0);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift' || event.key.startsWith('Arrow')) capture();
    };

    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [capture, enabled]);

  return { selection, clear };
}
