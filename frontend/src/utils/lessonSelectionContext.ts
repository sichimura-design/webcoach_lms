/**
 * 教材ページのAIコーチへ渡す「いま見ている箇所」の文脈を、教材DOMから切り出すユーティリティ。
 *
 * 教材は同一オリジンの srcdoc iframe（mod/page）か、メインDOMへの直描画（mod/label 等）の
 * どちらかで表示される。どちらでも「選択範囲(Range)」と「教材本文のルート要素」さえあれば
 * 同じ計算で済むので、DOMの種類を意識しない形にしている。
 */

/** 選択箇所の前後に添える文章の長さ（文字数） */
export const SELECTION_SURROUNDING_CHARS = 300;
/** AIへ送るレッスン本文抜粋の上限（文字数）。api-server側の上限(6000)より十分小さくする */
export const LESSON_TEXT_MAX_CHARS = 4000;

export interface SelectionContext {
  /** 選択した文章 */
  text: string;
  /** 選択箇所の直前にある見出し（h1〜h4）。見出しより前を選んだ場合は null */
  heading: string | null;
  /** 選択箇所の直前の文章（末尾から SELECTION_SURROUNDING_CHARS 文字） */
  before: string;
  /** 選択箇所の直後の文章（先頭から SELECTION_SURROUNDING_CHARS 文字） */
  after: string;
}

const collapseWhitespace = (s: string) => s.replace(/\s+/g, ' ').trim();

/** 選択範囲から、直近の見出しと前後の文章を切り出す */
export function captureSelectionContext(range: Range, root: Node): SelectionContext {
  const doc = root.ownerDocument ?? (root as Document);

  const beforeRange = doc.createRange();
  beforeRange.selectNodeContents(root);
  beforeRange.setEnd(range.startContainer, range.startOffset);

  const afterRange = doc.createRange();
  afterRange.selectNodeContents(root);
  afterRange.setStart(range.endContainer, range.endOffset);

  const before = collapseWhitespace(beforeRange.toString());
  const after = collapseWhitespace(afterRange.toString());

  // 文書順で選択開始位置より前にある最後の見出し
  let heading: string | null = null;
  const headings = (root as Element | Document).querySelectorAll?.('h1, h2, h3, h4') ?? [];
  for (const el of Array.from(headings)) {
    const headingRange = doc.createRange();
    headingRange.selectNode(el);
    if (headingRange.compareBoundaryPoints(Range.START_TO_START, range) > 0) break;
    const text = collapseWhitespace(el.textContent ?? '');
    if (text) heading = text;
  }

  return {
    text: collapseWhitespace(range.toString()),
    heading,
    before: before.slice(-SELECTION_SURROUNDING_CHARS),
    after: after.slice(0, SELECTION_SURROUNDING_CHARS),
  };
}

/** 教材本文のテキストを抜粋する（script/style は除く） */
export function extractLessonText(root: Element | null | undefined): string {
  if (!root) return '';
  const clone = root.cloneNode(true) as Element;
  clone.querySelectorAll('script, style, noscript').forEach((el) => el.remove());
  return collapseWhitespace(clone.textContent ?? '').slice(0, LESSON_TEXT_MAX_CHARS);
}

/** HTML文字列から本文テキストを抜粋する（iframe の DOM に触れない場合のフォールバック） */
export function extractLessonTextFromHtml(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return extractLessonText(doc.body);
}
