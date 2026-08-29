import { LessonBlock } from '../../types/lesson';

/**
 * 教材ブロックを「章」にまとめる純関数。
 *
 * 参照デザインの 01 / 02 という赤丸の番号と、その横の見出しを出すために要る。
 * 🔴 そのためのフィールドをAPIに足していない。LessonBlock.heading は
 *    連続するブロックで同じ値が入る（例：「配色の役割」が2ブロックにまたがる）ので、
 *    その連続をひとまとまり＝1章として数えれば番号が作れる。
 */
export interface LessonSection {
  /** 1始まりの章番号。表示は padStart(2,'0') で 01, 02 にする */
  index: number;
  /** 章見出し。取れなければ null（番号だけ出す） */
  heading: string | null;
  blocks: LessonBlock[];
}

/** heading が連続一致するブロックをまとめる。heading が無いブロックも1章として扱う */
export function groupByHeading(blocks: LessonBlock[]): LessonSection[] {
  const sections: LessonSection[] = [];
  for (const block of blocks) {
    const heading = block.heading ?? null;
    const last = sections[sections.length - 1];
    if (last && last.heading === heading && heading !== null) {
      last.blocks.push(block);
    } else {
      sections.push({ index: sections.length + 1, heading, blocks: [block] });
    }
  }
  return sections;
}

/**
 * HTML の先頭にある見出し要素を切り出す。
 *
 * 本文の先頭が <h2>3. 比率は…</h2> のように「手書きの番号」を含むことがある。
 * 章番号バッジと二重になるので、先頭の "3." "3、" "3．" は剥がす。
 *
 * @param html  ブロックのHTML
 * @param tags  切り出したいタグ（先に一致したものを使う）
 * @returns label = 見出しテキスト（無ければ null）、rest = 残りのHTML
 */
export function splitLeadingHeading(
  html: string,
  tags: string[] = ['h2', 'h3', 'strong'],
): { label: string | null; rest: string } {
  const trimmed = html.trimStart();
  for (const tag of tags) {
    const re = new RegExp(`^<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
    const m = trimmed.match(re);
    if (!m) continue;
    const label = stripTags(m[1]).replace(/^\s*\d+\s*[.．、)）]\s*/, '').trim();
    if (!label) continue;
    return { label, rest: trimmed.slice(m[0].length) };
  }
  return { label: null, rest: html };
}

/** 箇条書きの <li> を配列にする。チェックリスト表示に使う */
export function extractListItems(html: string): string[] {
  const items: string[] = [];
  const re = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m = re.exec(html);
  while (m) {
    const text = stripTags(m[1]).trim();
    if (text) items.push(text);
    m = re.exec(html);
  }
  return items;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}
