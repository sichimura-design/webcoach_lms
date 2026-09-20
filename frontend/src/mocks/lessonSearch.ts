/**
 * frontend/src/mocks/lessonSearch.ts
 * コース内の教材本文検索（GET /api/webcoach/courses/:courseId/search）の中身。
 *
 * 「オートレイアウト」「配色」のような単語で、そのコースのどのレッスンの
 * どの段落が扱っているかを返す。lesson-ai の searchMaterial（AIの根拠さがし）とは
 * 目的が違うので別実装にしてある:
 *
 *   searchMaterial … 質問文から語を切り出し、いま開いているレッスンを中心に
 *                    優先度をつけてスコアリングする。狙いは「回答の根拠」
 *   ここ           … 打たれた語そのものをコース全体から素直に拾い、
 *                    カリキュラム順に並べる。狙いは「どこに書いてあるか」
 *
 * 検索語を分かち書きで切らないのは、打った語がそのまま当たるほうが
 * 「検索」として振る舞いが読めるため。代わりに1文字クエリは弾く。
 *
 * import の向き: handlers.ts → このファイル → lessonHandlers.ts
 * （ハンドラを lessonHandlers.ts 側に置くと相互 import になるので置かない）
 */

import type { LessonBlock } from '../types/lesson';
import type {
  LessonSearchGroup,
  LessonSearchHit,
  LessonSearchResponse,
} from '../types/lessonSearch';
import { buildLessonDoc, buildOutline } from './lessonHandlers';

/** 1レッスンあたりに添える抜粋の上限。hitCount は間引く前の実数を返す */
const MAX_HITS_PER_LESSON = 3;
/** 返すレッスンの上限。これを超えるほど当たる語は、絞り込みを促したほうが早い */
const MAX_LESSONS = 30;
/** 抜粋でヒット語の前後に残す文字数 */
const EXCERPT_BEFORE = 25;
const EXCERPT_AFTER = 45;

/**
 * 索引に載せるブロック1件。
 * text は表示用の素のテキスト、folded は照合用。**2つは必ず同じ長さ**で、
 * folded で得た位置をそのまま text に当てて抜粋を切る。
 */
interface IndexedBlock {
  lessonId: number;
  blockId: string;
  heading: string;
  kind: LessonBlock['kind'];
  text: string;
  folded: string;
}

/**
 * 照合用に文字を畳む。**長さを変えないことが条件**。
 *
 * 🔴 String.normalize('NFKC') は使わない。`ｶﾞ`→`ガ` のように1文字へ縮むため、
 *    畳んだ文字列で取った位置が元テキストとズレて、抜粋が1文字ずつずれる。
 *    また畳んだ側から抜粋を切ると英字が小文字に潰れて「ChatGPT」が
 *    「chatgpt」と表示されてしまう。
 * 畳むのは (1) 英字の小文字化 (2) 全角英数 → 半角 (3) 全角スペース → 半角 の3つだけ。
 * いずれも1文字→1文字なので位置が保たれる。半角カナは畳まない（当たらない）。
 */
function fold(text: string): string {
  return text
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ')
    .toLowerCase();
}

/**
 * ブロックの検索対象テキスト。
 * plain が空のブロック（図解・確認問題・動画）が実教材で67件あり、
 * そのままだと確認問題の中の語が永久に当たらないので代用を足す。
 */
function searchableText(block: LessonBlock): string {
  const parts = [block.plain];
  if (block.quiz) {
    parts.push(block.quiz.question);
    block.quiz.choices.forEach((c) => parts.push(c.text, c.explain));
  }
  if (block.media) parts.push(block.media.alt ?? '', block.media.caption ?? '');
  return parts.filter(Boolean).join(' ');
}

/**
 * コースの索引。打鍵のたびに buildLessonDoc をレッスン数ぶん走らせないため、
 * 一度組んだら使い回す。モックのデータは起動中に増減しないので破棄は要らない。
 */
const indexCache = new Map<number, IndexedBlock[]>();

function courseIndex(courseId: number): IndexedBlock[] {
  const cached = indexCache.get(courseId);
  if (cached) return cached;

  const blocks: IndexedBlock[] = [];
  // buildOutline は移行済み教材があればそちらを返す。ここを buildCourseStructure に
  // すると移行コースで汎用レッスンを舐めることになり、実教材に当たらない
  for (const section of buildOutline(courseId).sections) {
    for (const lesson of section.lessons) {
      const doc = buildLessonDoc(courseId, lesson.lessonId);
      if (!doc) continue;
      for (const block of doc.blocks) {
        const text = searchableText(block);
        if (!text) continue;
        blocks.push({
          lessonId: lesson.lessonId,
          blockId: block.id,
          heading: block.heading,
          kind: block.kind,
          text,
          folded: fold(text),
        });
      }
    }
  }

  indexCache.set(courseId, blocks);
  return blocks;
}

/** ヒット語の前後を切り出す。落とした側に … を付けて、途中であることを示す */
function buildExcerpt(text: string, at: number, length: number): Omit<LessonSearchHit, 'blockId' | 'heading' | 'kind'> {
  const from = Math.max(0, at - EXCERPT_BEFORE);
  const to = Math.min(text.length, at + length + EXCERPT_AFTER);
  const head = from > 0 ? '…' : '';
  const tail = to < text.length ? '…' : '';
  return {
    excerpt: `${head}${text.slice(from, to)}${tail}`,
    matchStart: head.length + (at - from),
    matchLength: length,
  };
}

/**
 * コース内の教材本文を検索する。
 *
 * @param courseId 対象コース
 * @param rawQuery 入力文字列（正規化前）
 */
export function searchInCourse(courseId: number, rawQuery: string): LessonSearchResponse {
  const query = (rawQuery ?? '').trim();
  const needle = fold(query);

  // 1文字は当たりすぎて役に立たない（日本語だと助詞や漢字1字が全レッスンに出る）
  if (needle.length < 2) {
    return { courseId, query, totalHits: 0, lessonCount: 0, groups: [] };
  }

  const outline = buildOutline(courseId);
  const blocks = courseIndex(courseId);

  // ブロックをレッスンごとにまとめる。索引はカリキュラム順に積んであるので
  // Map の挿入順がそのまま並び順になる
  const hitsByLesson = new Map<number, { hitCount: number; hits: LessonSearchHit[] }>();
  let totalHits = 0;

  for (const block of blocks) {
    // 照合は folded、抜粋の切り出しは text。両者は同じ長さなので位置を共有できる
    let at = block.folded.indexOf(needle);
    if (at < 0) continue;

    let entry = hitsByLesson.get(block.lessonId);
    if (!entry) {
      entry = { hitCount: 0, hits: [] };
      hitsByLesson.set(block.lessonId, entry);
    }

    // 同じブロック内の複数ヒットも数える。抜粋は1ブロックにつき先頭の1つだけ
    // （同じ段落の抜粋が並ぶと、レッスンの手がかりとしての密度が落ちる）
    let first = true;
    while (at >= 0) {
      entry.hitCount += 1;
      totalHits += 1;
      if (first && entry.hits.length < MAX_HITS_PER_LESSON) {
        entry.hits.push({
          blockId: block.blockId,
          heading: block.heading,
          kind: block.kind,
          ...buildExcerpt(block.text, at, needle.length),
        });
      }
      first = false;
      at = block.folded.indexOf(needle, at + needle.length);
    }
  }

  // 目次を引き直して、チャプター名・レッスン名・完了状態を添える
  const groups: LessonSearchGroup[] = [];
  outline.sections.forEach((section, sectionIndex) => {
    section.lessons.forEach((lesson) => {
      const entry = hitsByLesson.get(lesson.lessonId);
      if (!entry || groups.length >= MAX_LESSONS) return;
      groups.push({
        lessonId: lesson.lessonId,
        lessonTitle: lesson.title,
        sectionId: section.id,
        sectionName: section.name,
        sectionIndex: sectionIndex + 1,
        state: lesson.state,
        hitCount: entry.hitCount,
        hits: entry.hits,
      });
    });
  });

  return {
    courseId,
    query,
    totalHits,
    lessonCount: groups.length,
    groups,
  };
}

export default searchInCourse;
