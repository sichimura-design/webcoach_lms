/**
 * frontend/src/components/learning/clipHighlight.ts
 *
 * 保存済みクリップを教材本文の元の位置へ復元し、<mark> で囲む。
 *
 * クリップは「ブロックID＋選択文章＋ブロック内オフセット」で保存している。
 * オフセットを第一候補にするのは、同じ語が複数回出てくる教材で違う箇所を
 * 光らせないため。教材が更新されてオフセットがずれた場合は、文章の検索に落とす。
 *
 * 注意: React が dangerouslySetInnerHTML で描画したノードを直接書き換えている。
 * ブロックのHTMLはレッスン内で不変なので React が再描画で衝突することはないが、
 * 再適用のたびに必ず clearClipMarks で元へ戻してから当て直すこと。
 */

export interface ClipAnchor {
  id: string;
  blockId: string;
  text: string;
  offset: number | null;
}

/** 挿入済みの <mark> をすべて外して元のテキストノードへ戻す */
export function clearClipMarks(container: HTMLElement): void {
  container.querySelectorAll('mark[data-clip-id]').forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
  });
  container.normalize();
}

/** ブロック内テキストの [start, end) を指す Range を作る */
function rangeAt(block: HTMLElement, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let consumed = 0;
  let startSet = false;

  let node = walker.nextNode() as Text | null;
  while (node) {
    const length = node.data.length;
    if (!startSet && consumed + length > start) {
      range.setStart(node, start - consumed);
      startSet = true;
    }
    if (startSet && consumed + length >= end) {
      range.setEnd(node, end - consumed);
      return range;
    }
    consumed += length;
    node = walker.nextNode() as Text | null;
  }
  return null;
}

/** クリップ1件を <mark> で囲む。囲めなければ false を返す。 */
function markOne(container: HTMLElement, clip: ClipAnchor): boolean {
  const block = container.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(clip.blockId)}"]`);
  if (!block || !clip.text) return false;

  const blockText = block.textContent ?? '';
  // 保存時のオフセットが今も一致すればそれを使う。ズレていれば文章検索へ落とす。
  const offsetValid =
    clip.offset !== null &&
    clip.offset >= 0 &&
    blockText.substr(clip.offset, clip.text.length) === clip.text;
  const start = offsetValid ? (clip.offset as number) : blockText.indexOf(clip.text);
  if (start < 0) return false;

  const range = rangeAt(block, start, start + clip.text.length);
  if (!range) return false;

  const mark = document.createElement('mark');
  mark.dataset.clipId = clip.id;
  mark.style.padding = '0 1px';
  mark.style.color = 'inherit';
  mark.style.background = 'linear-gradient(transparent 55%, #FFE58A 55%)';

  try {
    range.surroundContents(mark);
    return true;
  } catch {
    // 選択が要素境界をまたいでいると surroundContents は失敗する。無理に囲まない。
    return false;
  }
}

/** すべてのクリップを当て直す */
export function applyClipMarks(container: HTMLElement, clips: ClipAnchor[]): void {
  clearClipMarks(container);
  // 後ろの位置から当てると、先に挿入した <mark> が前方のオフセットを壊さない
  const ordered = [...clips].sort((a, b) => (b.offset ?? 0) - (a.offset ?? 0));
  ordered.forEach((clip) => markOne(container, clip));
}
