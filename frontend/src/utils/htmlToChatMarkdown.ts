/**
 * Dify アプリの本文に混ざる HTML（見出し・表・強調など）を Markdown に直す。
 *
 * デザインフィードバックメンター等は、Dify 標準UIで描画される前提で
 * `<h3>プロジェクト概要</h3><table>…</table>` のような HTML を本文に含めて返す。
 * チャット側は Markdown として描画する（生の HTML は描画しない）ため、そのままだと
 * タグが文字としてそのまま見えてしまう。ここで Markdown の書き方に置き換える。
 * - 対象のタグを含まない本文と、コードブロックの中は触らない
 * - 知らないタグは外して中身の文字だけ残す
 */

const HTML_TAG_RE =
  /<\/?(h[1-6]|p|div|section|article|br|hr|table|thead|tbody|tfoot|tr|th|td|strong|b|em|i|u|ul|ol|li|span|a|code|pre|blockquote|img|small|mark)\b[^>]*>/i;
const ANY_TAG_RE = /<[^>]+>/g;
const FENCE_SPLIT_RE = /(^ {0,3}(?:```|~~~)[^\n]*\n[\s\S]*?^ {0,3}(?:```|~~~)[ \t]*$)/m;

export function hasHtmlMarkup(text: string): boolean {
  return !!text && HTML_TAG_RE.test(text);
}

/** 本文中の HTML を Markdown に直す。HTML が無ければそのまま返す */
export function htmlToChatMarkdown(text: string): string {
  if (!hasHtmlMarkup(text)) return text;
  // コードブロックは HTML の例を載せていることがあるので、その外側だけ変換する
  return text
    .split(new RegExp(FENCE_SPLIT_RE.source, 'gm'))
    .map((part) => (/^ {0,3}(```|~~~)/.test(part) ? part : convertFragment(part)))
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** すでに DOM になった本文（ボタン・フォームを取り除いた後）を Markdown にする */
export function domToChatMarkdown(root: Node): string {
  return nodeToMarkdown(root).replace(/\n{3,}/g, '\n\n').trim();
}

function convertFragment(html: string): string {
  if (!hasHtmlMarkup(html)) return html;
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<br\s*\/?>/gi, '\n').replace(ANY_TAG_RE, '');
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return nodeToMarkdown(doc.body);
}

function childrenToMarkdown(node: Node): string {
  return Array.from(node.childNodes).map(nodeToMarkdown).join('');
}

/** 見出し・表のセルなど、1行に収めたい中身 */
function inline(node: Node): string {
  return childrenToMarkdown(node).replace(/\s*\n\s*/g, ' ').trim();
}

function block(body: string): string {
  const trimmed = body.trim();
  return trimmed ? `\n\n${trimmed}\n\n` : '';
}

function wrapInline(mark: string, node: Node): string {
  const body = childrenToMarkdown(node);
  const trimmed = body.trim();
  if (!trimmed) return body;
  // 「**  太字 **」のように内側に空白があると強調にならないので外側へ出す
  const lead = body.match(/^\s*/)?.[0] ?? '';
  const tail = body.match(/\s*$/)?.[0] ?? '';
  return `${lead}${mark}${trimmed}${mark}${tail}`;
}

function nodeToMarkdown(node: Node): string {
  if (node.nodeType === 3 /* TEXT_NODE */) return node.textContent ?? '';
  if (node.nodeType !== 1 /* ELEMENT_NODE */) {
    return node.nodeType === 9 || node.nodeType === 11 ? childrenToMarkdown(node) : '';
  }
  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const body = inline(el);
      return body ? `\n\n${'#'.repeat(Number(tag[1]))} ${body}\n\n` : '';
    }
    case 'br':
      return '\n';
    case 'hr':
      return '\n\n---\n\n';
    case 'strong':
    case 'b':
      return wrapInline('**', el);
    case 'em':
    case 'i':
      return wrapInline('*', el);
    case 'code':
      return `\`${el.textContent ?? ''}\``;
    case 'pre':
      return `\n\n\`\`\`\n${(el.textContent ?? '').replace(/\n$/, '')}\n\`\`\`\n\n`;
    case 'a': {
      const href = el.getAttribute('href');
      const body = inline(el);
      return href && /^(https?:|mailto:)/i.test(href) ? `[${body || href}](${href})` : body;
    }
    case 'img':
      return '';
    case 'ul':
    case 'ol':
      return listToMarkdown(el, tag === 'ol');
    case 'li':
      return block(`- ${childrenToMarkdown(el).trim()}`);
    case 'blockquote':
      return block(
        childrenToMarkdown(el)
          .trim()
          .split('\n')
          .map((l) => `> ${l}`)
          .join('\n'),
      );
    case 'table':
      return tableToMarkdown(el);
    case 'p':
    case 'div':
    case 'section':
    case 'article':
      return block(childrenToMarkdown(el));
    case 'script':
    case 'style':
      return '';
    default:
      return childrenToMarkdown(el);
  }
}

function listToMarkdown(listEl: Element, ordered: boolean): string {
  const items = Array.from(listEl.children).filter((c) => c.tagName.toLowerCase() === 'li');
  const lines = items.map((li, i) => {
    const marker = ordered ? `${i + 1}. ` : '- ';
    const body = childrenToMarkdown(li)
      .replace(/\n{2,}/g, '\n')
      .trim()
      .split('\n')
      .map((l, j) => (j === 0 ? l : `${' '.repeat(marker.length)}${l.trim()}`))
      .join('\n');
    return `${marker}${body}`;
  });
  return block(lines.join('\n'));
}

function tableToMarkdown(tableEl: Element): string {
  const rows = Array.from(tableEl.querySelectorAll('tr')).filter((tr) => tr.closest('table') === tableEl);
  if (rows.length === 0) return block(inline(tableEl));
  const cellsOf = (tr: Element) => Array.from(tr.children).filter((c) => /^t[hd]$/i.test(c.tagName));

  // 「見出しセル(th) + 値(td)」の縦並びの表（概要 / ターゲット / …）は、
  // 1行目を表の見出しにすると意味が崩れるので「**見出し**」+ 値の段落に直す
  const isKeyValue =
    !tableEl.querySelector('thead') &&
    rows.every((tr) => {
      const cells = cellsOf(tr);
      return cells.length === 2 && cells[0].tagName.toLowerCase() === 'th' && cells[1].tagName.toLowerCase() === 'td';
    });
  if (isKeyValue) {
    return rows
      .map((tr) => {
        const [th, td] = cellsOf(tr);
        return block(`**${inline(th)}**\n${childrenToMarkdown(td).replace(/\n{2,}/g, '\n').trim()}`);
      })
      .join('');
  }

  // 表のセルは1行にしか書けない（<br> は描画されない）ので、改行は「 / 」でつなぐ
  const cellText = (c: Element) =>
    childrenToMarkdown(c)
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .join(' / ')
      .replace(/\|/g, '\\|');
  const matrix = rows.map((tr) => cellsOf(tr).map(cellText));
  const width = Math.max(...matrix.map((r) => r.length));
  if (width === 0) return '';
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill('')];
  const line = (r: string[]) => `| ${pad(r).join(' | ')} |`;
  const [head, ...body] = matrix;
  return block([line(head), line(Array(width).fill('---')), ...body.map(line)].join('\n'));
}
