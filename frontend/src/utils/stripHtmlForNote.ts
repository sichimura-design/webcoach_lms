/**
 * AI回答をノートへ保存する前に、本文中のHTMLタグを取り除いてプレーンテキストにする。
 *
 * 連携先のDifyアプリは応答にHTML（ボタン付きカードの <div>、<br>、<ul> 等）を混ぜて返す。
 * チャット画面ではボタンを抜き出して描画しているが、ノートはMarkdown本文として
 * 保存・表示するため、そのまま入れるとタグが文字として見えてしまう。
 *
 * 🔴 コードブロック（```〜``` と `〜`）の中は触らない。教材の質問で
 *    「このHTMLの書き方は？」と聞いた回答のサンプルコードまで消えてしまうため。
 * 🔴 ボタン（data-message 付き）はチャット上の操作用なので、それを含むカードごと落とす。
 *    チャット表示（utils/difyButtons.ts の parseDifyMessage）と同じ単位。
 */
const CODE_RE = /(```[\s\S]*?```|`[^`\n]*`)/g;
const TAG_RE = /<\/?[a-zA-Z][^>]*>/;
const ANY_TAG_RE = /<\/?[a-zA-Z][^>]*>/g;

// FORM：Dify の入力フォーム（応募文メーカー等）もチャット上の操作用なので、ノートには残さない
const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'BUTTON', 'TEMPLATE', 'FORM']);
const BLOCK_TAGS = new Set([
  'P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'UL', 'OL', 'TABLE', 'THEAD', 'TBODY',
  'TR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'HR', 'DL', 'DT', 'DD',
]);

function nodeToText(node: Node, topLevel: boolean): string {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    // body直下の文字列はMarkdown本文なので改行・インデントをそのまま残す。
    // タグの中の文字列はHTMLの整形用の空白なので1つに詰める。
    return topLevel ? text : text.replace(/\s+/g, ' ');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const el = node as Element;
  const tag = el.tagName;
  if (DROP_TAGS.has(tag)) return '';
  if (tag === 'BR') return '\n';

  const inner = Array.from(el.childNodes)
    .map((child) => nodeToText(child, false))
    .join('');

  if (tag === 'LI') return `\n- ${inner.trim()}`;
  if (tag === 'TD' || tag === 'TH') return `${inner.trim()} `;
  if (BLOCK_TAGS.has(tag)) return `\n${inner.trim()}\n`;
  return inner;
}

function htmlToText(part: string): string {
  if (!TAG_RE.test(part)) return part;
  if (typeof DOMParser === 'undefined') return part.replace(ANY_TAG_RE, '');

  const doc = new DOMParser().parseFromString(part, 'text/html');
  return Array.from(doc.body.childNodes)
    .filter((child) => !(child instanceof Element && child.querySelector('button[data-message]')))
    .filter((child) => !(child instanceof Element && child.matches('button[data-message]')))
    .map((child) => nodeToText(child, true))
    .join('');
}

export function stripHtmlForNote(content: string): string {
  if (!content || !TAG_RE.test(content)) return content;

  return content
    .split(CODE_RE)
    .map((part, i) => (i % 2 === 1 ? part : htmlToText(part)))
    .join('')
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
