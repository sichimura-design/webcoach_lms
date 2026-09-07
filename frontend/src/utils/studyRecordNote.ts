import bffClient from '../services/bffClient';
import { NoteSourceRef } from '../types/notes';
import { ACHIEVEMENT_LABEL, Achievement } from '../types/studyActivity';
import { formatMinutesHM } from './studyStats';

/**
 * 学習記録の内容を、マイノートの1件のノートとして残す。
 *
 * 【なぜ要るか】
 * 学習記録の「学習した内容」「一言メモ」は記録（/log）だけに残り、マイノートには
 * 入らない作りだった。書いたつもりでマイノートを探して見つからない、という声が
 * あったので、モーダル側で行き先を名指ししてしのいでいた。
 * そこから一歩進めて「マイノートにも残す」を選べるようにしたのがこの経路。
 *
 * 🔴 記録の保存が成功したあとに呼ぶ。ここが失敗しても学習記録は成立しているので、
 *    呼び出し側は記録自体を失敗扱いにしないこと。
 * 🔴 記録1件につき1回だけ呼ぶ。既存の記録を編集するたびに呼ぶとノートが増える。
 */

export interface StudyRecordNoteInput {
  /** YYYY-MM-DD。タイトルの既定値に使う */
  localDate: string;
  minutes: number;
  course: {
    courseId: number;
    courseTitle: string;
    lessonId?: number;
    lessonTitle?: string;
  } | null;
  goalText: string;
  contentNote: string;
  memo: string;
  achievement: Achievement | null;
}

/** タイトルの上限。ノート面のタイトル欄と一覧カードで1〜2行に収まる長さ */
const TITLE_MAX = 40;

/** `2026-09-04` → `9/4 の学習`。タイトルに書くものが無いときの既定値 */
function dateTitle(localDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!m) return '学習の記録';
  return `${Number(m[2])}/${Number(m[3])} の学習`;
}

/** 学習した内容の1行目をタイトルにする。空なら日付見出し */
function titleOf(input: StudyRecordNoteInput): string {
  const head = input.contentNote
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (!head) return dateTitle(input.localDate);
  return head.length > TITLE_MAX ? `${head.slice(0, TITLE_MAX)}…` : head;
}

/** 教材名。レッスンまで分かっていれば「コース / レッスン」 */
function courseLabel(course: StudyRecordNoteInput['course']): string | null {
  if (!course) return null;
  return [course.courseTitle, course.lessonTitle].filter(Boolean).join(' / ');
}

/**
 * 本文。ノート本文のミニ記法（components/notes/noteText.tsx）で組む。
 * `## ` が見出し、`- ` が箇条書きになる。空の項目は落とす。
 */
export function buildStudyRecordNoteText(input: StudyRecordNoteInput): string {
  const sections: string[] = [];

  const contentNote = input.contentNote.trim();
  if (contentNote) sections.push(`## 学習した内容\n${contentNote}`);

  const memo = input.memo.trim();
  if (memo) sections.push(`## 一言メモ\n${memo}`);

  // 自動で分かっている事実は最後にまとめる。自分で書いた文章より前に置くと、
  // 読み返したときに数字が先に目に入って本文が埋もれる
  const facts: string[] = [`- 学習時間: ${formatMinutesHM(input.minutes)}`];
  const course = courseLabel(input.course);
  if (course) facts.push(`- 教材: ${course}`);
  const goal = input.goalText.trim();
  if (goal) facts.push(`- 今回の学習目標: ${goal}`);
  if (input.achievement) facts.push(`- 手応え: ${ACHIEVEMENT_LABEL[input.achievement]}`);
  sections.push(facts.join('\n'));

  return sections.join('\n\n');
}

/**
 * ノートを1件作って本文を入れる。作ったノートのIDを返す。
 * 未整理（folderId を渡さない）に入る。取り込んだものが最初に入る場所と同じ扱い。
 */
export async function createNoteFromStudyRecord(input: StudyRecordNoteInput): Promise<string> {
  /*
   * 出どころ。レッスンまで特定できるときだけ「教材」にする。
   * 🔴 NoteSourceRef は lessonId が必須なので、教材だけ選んで
   *    レッスンが分からない記録（手動追加など）は source を作れない。
   *    その場合は「自分のノート」にする。
   */
  const source: NoteSourceRef | null =
    input.course && input.course.lessonId
      ? {
          courseId: input.course.courseId,
          courseName: input.course.courseTitle,
          lessonId: input.course.lessonId,
          lessonTitle: input.course.lessonTitle ?? '',
          // 教材本文の位置ではなく学習記録から生まれたので、位置の手がかりは持たない
          heading: null,
          blockId: null,
          offset: null,
        }
      : null;

  const note = await bffClient.createNote({
    title: titleOf(input),
    source,
    origin: source ? 'material' : 'self',
  });

  await bffClient.appendNoteBlock(note.id, {
    kind: 'text',
    text: buildStudyRecordNoteText(input),
  });

  return note.id;
}
