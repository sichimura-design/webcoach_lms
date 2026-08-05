/**
 * frontend/src/types/notes.ts
 * マイノート（自分のメモ / 教材クリップ / ⭐保存したAI回答）の型。
 *
 * lesson.ts と同じく実BFFには存在せず、MSW（mocks/lessonHandlers.ts）が
 * localStorage を裏に置いて永続化している。実API化するときはハンドラを
 * 削除して bffClient のベースURLが実サーバを向くだけで済むようにしてある。
 */

/**
 * memo   … 自分で書いたメモ（教材単位の下書きから「メモとして残す」したもの）
 * clip   … 教材本文を選択して保存したもの。元の位置へ戻れる
 * answer … ⭐保存したAI回答。質問と回答をセットで持つ
 */
export type NoteKind = 'memo' | 'clip' | 'answer';

export const NOTE_KIND_LABEL: Record<NoteKind, string> = {
  memo: '自分のメモ',
  clip: 'クリップ',
  answer: '保存したAI回答',
};

/** マイノートのタブ。'all' は絞り込みなし。 */
export type NoteFilter = 'all' | NoteKind;

export const NOTE_FILTER_LABEL: Record<NoteFilter, string> = {
  all: 'すべて',
  ...NOTE_KIND_LABEL,
};

export interface NoteItem {
  id: string;
  kind: NoteKind;
  courseId: number;
  courseName: string;
  lessonId: number;
  lessonTitle: string;
  blockId: string | null;   // clip / answer が参照する教材ブロック
  heading: string | null;   // 保存時に見ていた見出し
  text: string;             // メモ本文 / クリップ文 / AI回答のプレーンテキスト
  question: string | null;  // answer のみ
  selectedText: string | null; // answer のとき引用していた教材文
  image: string | null;     // answer のとき添付していた画像（dataURL）
  /** clip のみ。ブロックの plain 内での開始オフセット。位置復元に使う。 */
  offset: number | null;
  createdAt: string;        // ISO8601
}

/** POST /webcoach/notes のリクエストボディ（id と createdAt はサーバが採番） */
export type NoteCreateInput = Omit<NoteItem, 'id' | 'createdAt'>;

/** GET /webcoach/notes のクエリ */
export interface NoteListQuery {
  kind?: NoteFilter;
  q?: string;
  courseId?: number;
  lessonId?: number;
}
