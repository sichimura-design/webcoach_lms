/**
 * frontend/src/utils/noteMarkdown.ts
 * ノート（本文 body ＋ 素材 blocks）と、実APIが持つ Markdown 単一列
 * （webcoach_my_note.contents）の相互変換。
 *
 * 【形】
 *   <本文。書いたとおりそのまま>
 *
 *   <素材1>
 *
 *   <素材2> …
 *
 * 本文を先に、素材（クリップ / AI回答）を後ろにまとめて並べる。
 * 読むときは「末尾から続く素材の形の段落」だけを素材として切り出し、
 * それより前は**一字も変えずに**本文とする。本文を段落に割って組み直さないので、
 * 空行の数・チェックリスト・見出しなどが保存と読み込みで変わらない。
 *
 * 【記法】
 * 🔴 メタデータを本文に埋め込まない。種別は「Markdownの形」から推測する。
 *    素のMarkdownにしておけば、他ツールに貼っても・AIに読ませても・手で編集しても壊れない。
 *
 *   > 引用
 *   > — [コース名 / レッスン名](/materials/12/lessons/34)   → clip（引用＋出典行）
 *   **Q:** 質問
 *
 *   **A:** 回答                                  → answer
 *
 * 【割り切っていること】
 * ・ブロックIDは読み込みのたびに振り直す（本文が正で、IDは描画のための一時的なもの）。
 * ・heading / selectedText / blockId / offset は保存しない。
 * ・本文がブロック単位だった頃のノートで、本文の途中に挟まっていた引用・Q&Aは
 *   素材に移さず本文の一部として読む（内容は消えない。移行はしない判断）。
 * ・ユーザーが本文の最後に自分で「引用＋出典リンク行」を書くと素材と判定される。
 */
import { NoteBlock, NoteClipBlock, NoteSourceRef } from '../types/notes';

const QUESTION_PREFIX = '**Q:**';
const ANSWER_PREFIX = '**A:**';

/** 出典行。`— [コース名 / レッスン名](/materials/<courseId>/lessons/<lessonId>)` */
const SOURCE_LINE = /^>?\s*—\s*\[(.*?)\]\(\/materials\/(\d+)\/lessons\/(\d+)\)\s*$/;

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
  if (block.kind === 'clip') {
    return `${quote(block.text)}\n> ${sourceLine(block.source)}`;
  }

  const lines = [`${QUESTION_PREFIX} ${block.question}`, '', `${ANSWER_PREFIX} ${block.answer}`];
  if (block.source) lines.push('', `> ${sourceLine(block.source)}`);
  return lines.join('\n');
}

/** 本文＋素材 → Markdown。ノートの contents としてサーバへ送る形 */
export function serializeNoteMarkdown(body: string, blocks: NoteBlock[]): string {
  const parts = [body.replace(/\s+$/, ''), ...blocks.map(serializeBlock)].filter((p) => p.trim() !== '');
  return parts.join('\n\n');
}

/** 空行で段落に割る（素材の判定用。本文はこれを通さない） */
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

type Stamp = { id: string; createdAt: string; updatedAt: string };

/** 引用＋出典行の段落なら clip */
function asClip(p: string, base: () => Stamp): NoteClipBlock | null {
  const lines = p.split('\n');
  if (!isQuoted(p) || lines.length < 2) return null;
  const source = parseSourceLine(unquote(lines[lines.length - 1]));
  if (!source) return null;
  return { ...base(), kind: 'clip', text: unquote(lines.slice(0, -1).join('\n')), source };
}

/**
 * 末尾の段落から遡って素材を切り出す。
 * 返すのは素材が始まる段落の番号（= 本文の段落数）と、先頭から並べた素材。
 */
function takeTrailingMaterials(paragraphs: string[], base: () => Stamp): { at: number; blocks: NoteBlock[] } {
  const found: NoteBlock[] = [];
  let i = paragraphs.length;
  while (i > 0) {
    const p = paragraphs[i - 1];

    // clip は2行以上（引用＋出典行）。answer の出典行は1行なので取り違えない
    const clip = asClip(p, base);
    if (clip) {
      found.unshift(clip);
      i -= 1;
      continue;
    }

    // answer: [**Q:**] [**A:**] [> 出典] の組を後ろから読む
    let j = i;
    let source: NoteSourceRef | null = null;
    if (isQuoted(p) && !p.includes('\n')) {
      source = parseSourceLine(unquote(p));
      if (source) j -= 1;
    }
    let answer: string | null = null;
    if (j > 0 && paragraphs[j - 1].startsWith(ANSWER_PREFIX)) {
      answer = paragraphs[j - 1].slice(ANSWER_PREFIX.length).trim();
      j -= 1;
    }
    if (j > 0 && paragraphs[j - 1].startsWith(QUESTION_PREFIX)) {
      const question = paragraphs[j - 1].slice(QUESTION_PREFIX.length).trim();
      found.unshift({
        ...base(),
        kind: 'answer',
        question,
        answer: answer ?? '',
        selectedText: null,
        image: null,
        source,
      });
      i = j - 1;
      continue;
    }
    break;
  }
  return { at: i, blocks: found };
}

/**
 * Markdown → 本文＋素材。
 * `at` は素材の作成/更新日時に使う（本文からは復元できないので、ノートの日時を渡す）。
 */
export function parseNoteMarkdown(markdown: string, at?: string): { body: string; blocks: NoteBlock[] } {
  if (!markdown || !markdown.trim()) return { body: '', blocks: [] };

  const stamp = at ?? new Date().toISOString();
  let n = 0;
  const base = (): Stamp => ({ id: `blk_${n++}`, createdAt: stamp, updatedAt: stamp });

  const paragraphs = toParagraphs(markdown);
  const { at: bodyCount, blocks } = takeTrailingMaterials(paragraphs, base);
  // 振り直し: 先頭から blk_0, blk_1 … にする（後ろから読んだので番号が逆になっている）
  blocks.forEach((b, i) => {
    b.id = `blk_${i}`;
  });
  if (blocks.length === 0) return { body: markdown.replace(/\s+$/, ''), blocks };
  if (bodyCount === 0) return { body: '', blocks };

  // 本文は原文から切り出す（段落に割って組み直すと空行などが変わる）
  const body = cutBeforeTail(markdown, paragraphs.slice(bodyCount));
  return { body, blocks };
}

/**
 * 原文から、末尾の段落列 `tail` が始まる手前までを返す。
 * 同じ文面の段落が本文にもある場合に備えて、後ろから1段落ずつ辿る。
 */
function cutBeforeTail(markdown: string, tail: string[]): string {
  let pos = markdown.length;
  for (let k = tail.length - 1; k >= 0; k -= 1) {
    const idx = markdown.lastIndexOf(tail[k], pos - 1);
    if (idx < 0) return markdown.replace(/\s+$/, '');
    pos = idx;
  }
  return markdown.slice(0, pos).replace(/\s+$/, '');
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
          // 画像記法は機能としては廃止したが、過去のノートに残っているので書き出しからは落とす
          .replace(/!\[.*?\]\(.*?\)/g, '')
          .trim()
      )
      .filter(Boolean)[0];
    if (plain) return plain.slice(0, 60);
  }
  return '';
}

/** 素材の数。一覧の NoteSummary.blockCount 用 */
export function blockCountOf(markdown: string): number {
  return parseNoteMarkdown(markdown).blocks.length;
}
