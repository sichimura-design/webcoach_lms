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
 * ・旧データで AI回答の後ろに自分の文章があると、それは回答の続きとして読まれる
 *   （回答は複数段落が普通なので、次の素材が来るまでを回答とみなすため）。内容は消えない。
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

/** 1行だけの出典行の段落（AI回答の末尾に付く）なら、その出典 */
function asSourceParagraph(p: string): NoteSourceRef | null {
  if (p.includes('\n') || !isQuoted(p)) return null;
  return parseSourceLine(unquote(p));
}

/** 素材の始まりになる段落か（ここで AI回答の続きの段落が終わる） */
function startsMaterial(p: string): boolean {
  return p.startsWith(QUESTION_PREFIX) || isClipShape(p) || asSourceParagraph(p) !== null;
}

function isClipShape(p: string): boolean {
  const lines = p.split('\n');
  return isQuoted(p) && lines.length >= 2 && parseSourceLine(unquote(lines[lines.length - 1])) !== null;
}

/**
 * paragraphs[from..] を丸ごと素材として読む。読み切れなければ null。
 *
 *   素材   := クリップ | AI回答
 *   AI回答 := **Q:** 段落 {続き} [ **A:** 段落 {続き} ] [出典行]
 *
 * 🔴 AIの回答は段落が複数あるのが普通（空行を含む）。**A:** の後ろは、次の素材の
 *    始まり（**Q:** / クリップ / 出典行）が来るまでを同じ回答の続きとして読む。
 *    これをしないと、2段落目以降が素材の形に見えず、回答ごと本文に落ちてしまう。
 */
function parseMaterialsFrom(paragraphs: string[], from: number, base: () => Stamp): NoteBlock[] | null {
  const blocks: NoteBlock[] = [];
  let i = from;
  const takeRun = (): string[] => {
    const run: string[] = [];
    while (i < paragraphs.length && !startsMaterial(paragraphs[i]) && !paragraphs[i].startsWith(ANSWER_PREFIX)) {
      run.push(paragraphs[i]);
      i += 1;
    }
    return run;
  };

  while (i < paragraphs.length) {
    const p = paragraphs[i];

    const clip = asClip(p, base);
    if (clip) {
      blocks.push(clip);
      i += 1;
      continue;
    }

    if (!p.startsWith(QUESTION_PREFIX)) return null;
    i += 1;
    const question = [p.slice(QUESTION_PREFIX.length).trim(), ...takeRun()].join('\n\n').trim();

    let answer = '';
    if (i < paragraphs.length && paragraphs[i].startsWith(ANSWER_PREFIX)) {
      const head = paragraphs[i].slice(ANSWER_PREFIX.length).trim();
      i += 1;
      answer = [head, ...takeRun()].join('\n\n').trim();
    }

    let source: NoteSourceRef | null = null;
    if (i < paragraphs.length) {
      source = asSourceParagraph(paragraphs[i]);
      if (source) i += 1;
    }

    blocks.push({ ...base(), kind: 'answer', question, answer, selectedText: null, image: null, source });
  }
  return blocks;
}

/**
 * 素材が始まる段落を探す。後ろまで丸ごと素材として読める最初の位置。
 * 見つからなければ段落数（= 全部本文）。
 */
function findMaterials(paragraphs: string[], base: () => Stamp): { at: number; blocks: NoteBlock[] } {
  for (let k = 0; k < paragraphs.length; k += 1) {
    const p = paragraphs[k];
    if (!p.startsWith(QUESTION_PREFIX) && !isClipShape(p)) continue;
    const blocks = parseMaterialsFrom(paragraphs, k, base);
    if (blocks) return { at: k, blocks };
  }
  return { at: paragraphs.length, blocks: [] };
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
  const { at: bodyCount, blocks } = findMaterials(paragraphs, base);
  // 途中で読み捨てた試行ぶん番号が飛ぶので、先頭から blk_0, blk_1 … に振り直す
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
