/**
 * frontend/src/utils/noteMarkdown.ts
 * ブロック配列（NoteBlock[]）と、実APIが持つ Markdown 単一列
 * （webcoach_my_note.contents）の相互変換。
 *
 * 【なぜ要るか】
 * ノート面のUIはブロック単位（text / clip / answer / image）で編集する前提で作られているが、
 * 実APIはノート本文を Markdown の1列で持つ。UIを作り替えずに実APIへ載せるため、
 * 保存時に blocks → Markdown、読込時に Markdown → blocks を通す。
 *
 * 【記法】
 * 🔴 メタデータを本文に埋め込まない。種別は「Markdownの形」から推測する。
 *    以前はHTMLコメントにJSONを持たせていたが、教材の位置復元（blockId / offset）を
 *    仕様として落とした時点で、機械可読な情報を持つ理由がほぼ消えた。
 *    素のMarkdownにしておけば、他ツールに貼っても・AIに読ませても・手で編集しても壊れない。
 *
 *   ## 見出し                                    → text
 *   > 引用
 *   > — [コース名 / レッスン名](/materials/12/lessons/34)   → clip（引用＋出典行）
 *   **Q:** 質問
 *   **A:** 回答                                  → answer
 *   ![alt](imageId)
 *   キャプション                                  → image
 *
 * 【割り切っていること】
 * ・ブロックIDは読み込みのたびに振り直す（本文が正で、IDは描画のための一時的なもの）。
 * ・heading / selectedText / blockId / offset は保存しない。
 * ・ユーザーが自分で「引用＋リンク行」を書くと clip と判定される。見た目はほぼ同じなので実害は無い。
 */
import { NoteBlock, NoteSourceRef } from '../types/notes';

const QUESTION_PREFIX = '**Q:**';
const ANSWER_PREFIX = '**A:**';

/** 出典行。`— [コース名 / レッスン名](/materials/<courseId>/lessons/<lessonId>)` */
const SOURCE_LINE = /^>?\s*—\s*\[(.*?)\]\(\/materials\/(\d+)\/lessons\/(\d+)\)\s*$/;
const IMAGE_LINE = /^!\[(.*?)\]\((.*?)\)\s*$/;

function sourceLine(source: NoteSourceRef): string {
  const label = [source.courseName, source.lessonTitle].filter(Boolean).join(' / ');
  return `— [${label}](/materials/${source.courseId}/lessons/${source.lessonId})`;
}

function quote(text: string): string {
  return text
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
}

function unquote(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^>\s?/, ''))
    .join('\n')
    .trim();
}

function serializeBlock(block: NoteBlock): string {
  if (block.kind === 'text') return block.text;

  if (block.kind === 'clip') {
    return `${quote(block.text)}\n> ${sourceLine(block.source)}`;
  }

  if (block.kind === 'answer') {
    const lines = [`${QUESTION_PREFIX} ${block.question}`, '', `${ANSWER_PREFIX} ${block.answer}`];
    if (block.source) lines.push('', `> ${sourceLine(block.source)}`);
    return lines.join('\n');
  }

  const img = `![${block.alt}](${block.imageId})`;
  return block.caption ? `${img}\n${block.caption}` : img;
}

/** blocks → Markdown。ノートの本文としてサーバへ送る形 */
export function serializeNoteMarkdown(blocks: NoteBlock[]): string {
  return blocks.map(serializeBlock).join('\n\n');
}

/** 空行で段落に割る */
function toParagraphs(markdown: string): string[] {
  return markdown
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+$/, ''))
    .filter((p) => p.trim() !== '');
}

function parseSourceLine(line: string): NoteSourceRef | null {
  const m = line.match(SOURCE_LINE);
  if (!m) return null;
  const [courseName, lessonTitle] = m[1].split(' / ');
  return {
    courseId: Number(m[2]),
    courseName: courseName ?? '',
    lessonTitle: lessonTitle ?? '',
    lessonId: Number(m[3]),
    heading: null,
    blockId: null,
    offset: null,
  };
}

/** その段落が丸ごと引用か */
function isQuoted(paragraph: string): boolean {
  return paragraph.split('\n').every((line) => line.startsWith('>'));
}

/**
 * Markdown → blocks。
 * `at` はブロックの作成/更新日時に使う（本文からは復元できないので、ノートの日時を渡す）。
 */
export function parseNoteMarkdown(markdown: string, at?: string): NoteBlock[] {
  if (!markdown || !markdown.trim()) return [];

  const stamp = at ?? new Date().toISOString();
  const paragraphs = toParagraphs(markdown);
  const blocks: NoteBlock[] = [];

  const base = () => {
    const id = `blk_${blocks.length}`;
    return { id, createdAt: stamp, updatedAt: stamp };
  };

  for (let i = 0; i < paragraphs.length; i += 1) {
    const p = paragraphs[i];
    const lines = p.split('\n');

    // --- answer: **Q:** の段落と、続く **A:** の段落をひと組で読む ---
    if (p.startsWith(QUESTION_PREFIX)) {
      const question = p.slice(QUESTION_PREFIX.length).trim();
      let answer = '';
      const next = paragraphs[i + 1];
      if (next && next.startsWith(ANSWER_PREFIX)) {
        answer = next.slice(ANSWER_PREFIX.length).trim();
        i += 1;
      }
      // さらに続く出典行も取り込む
      let source: NoteSourceRef | null = null;
      const after = paragraphs[i + 1];
      if (after && isQuoted(after)) {
        const parsed = parseSourceLine(unquote(after));
        if (parsed) {
          source = parsed;
          i += 1;
        }
      }
      blocks.push({ ...base(), kind: 'answer', question, answer, selectedText: null, image: null, source });
      continue;
    }

    // --- clip: 丸ごと引用で、最終行が出典行 ---
    if (isQuoted(p) && lines.length >= 2) {
      const source = parseSourceLine(unquote(lines[lines.length - 1]));
      if (source) {
        const text = unquote(lines.slice(0, -1).join('\n'));
        blocks.push({ ...base(), kind: 'clip', text, source });
        continue;
      }
    }

    // --- image: 先頭行が画像記法。残りはキャプション ---
    const img = lines[0].match(IMAGE_LINE);
    if (img) {
      const caption = lines.slice(1).join('\n').trim();
      blocks.push({
        ...base(),
        kind: 'image',
        imageId: img[2],
        alt: img[1],
        caption: caption || null,
      });
      continue;
    }

    // --- それ以外は text ---
    blocks.push({ ...base(), kind: 'text', text: p.trim() });
  }

  return blocks;
}

/** 一覧カードの書き出し。記法を落として素の文にする */
export function excerptFromMarkdown(markdown: string): string {
  for (const paragraph of toParagraphs(markdown)) {
    const plain = paragraph
      .split('\n')
      .filter((line) => !SOURCE_LINE.test(line))
      .map((line) =>
        line
          .replace(/^>\s?/, '')
          .replace(/^\s*(#{1,6}\s+|-\s+)/, '')
          .replace(/^\*\*[QA]:\*\*\s*/, '')
          .replace(/==(.+?)==/g, '$1')
          .replace(/!\[.*?\]\(.*?\)/g, '')
          .trim()
      )
      .filter(Boolean)[0];
    if (plain) return plain.slice(0, 60);
  }
  return '';
}

/** ブロック数。一覧の NoteSummary.blockCount 用 */
export function blockCountOf(markdown: string): number {
  return parseNoteMarkdown(markdown).length;
}
