/**
 * frontend/src/types/notes.ts
 * マイノート＝「学習に特化したシンプルな自由帳」の型。
 *
 * 【なぜ作り替えたか】
 * 以前は メモ / クリップ / AI回答 を別々のレコードとして時系列に並べる履歴だった。
 * レビュー指摘は「単なるメモ履歴ではなく、ユーザーが自分でノートを作成し、
 * その中に文章・クリップ・AI回答を自由に追加して、自分なりの学習ノートを
 * 育てていけるものにする」。器（Note）と中身（NoteBlock）に分けたのはそのため。
 *
 * 実BFFには存在せず、MSW（mocks/noteHandlers.ts）が localStorage を裏に置いて
 * 永続化している。実API化するときはハンドラを削除するだけで済むようにしてある。
 */

/**
 * text   … 自分で書いた文章。見出し・箇条書き・ハイライトは本文中の記法で表す
 * clip   … 教材本文を選択して取り込んだもの。元の位置へ戻れる
 * answer … AIコーチの回答。質問とセットで持つ
 */
export type NoteBlockKind = 'text' | 'clip' | 'answer';

export const NOTE_BLOCK_LABEL: Record<NoteBlockKind, string> = {
  text: '本文',
  clip: 'クリップ',
  answer: 'AI回答',
};

/** ブロックの出どころ。「元のレッスンへ」と本文ハイライトの復元に使う */
export interface NoteSourceRef {
  courseId: number;
  courseName: string;
  lessonId: number;
  lessonTitle: string;
  /** 取り込んだときに見ていた見出し */
  heading: string | null;
  /** 教材ブロックのID。クリップの位置復元に要る */
  blockId: string | null;
  /** ブロック内テキストの開始位置。同じ語が複数回出る教材で別の箇所を光らせないため */
  offset: number | null;
}

interface NoteBlockBase {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface NoteTextBlock extends NoteBlockBase {
  kind: 'text';
  text: string;
}

export interface NoteClipBlock extends NoteBlockBase {
  kind: 'clip';
  text: string;
  source: NoteSourceRef;
}

export interface NoteAnswerBlock extends NoteBlockBase {
  kind: 'answer';
  question: string;
  answer: string;
  /** 質問したときに引用していた教材文 */
  selectedText: string | null;
  /** 添付していた画像（dataURL） */
  image: string | null;
  source: NoteSourceRef | null;
}

export type NoteBlock = NoteTextBlock | NoteClipBlock | NoteAnswerBlock;

export interface Note {
  id: string;
  title: string;
  blocks: NoteBlock[];
  favorite: boolean;
  /**
   * レッスンから作られたノートの出どころ。
   * 「新しいノートを作成」から作ったものは null。
   * ノート面のメタ行「Webデザイン入門 / Lesson 4」はこれを描く。
   */
  source: NoteSourceRef | null;
  createdAt: string;
  updatedAt: string;
}

/** 一覧に出す軽量表現。ブロック全部を持たせると一覧の取得が重くなる */
export interface NoteSummary {
  id: string;
  title: string;
  favorite: boolean;
  blockCount: number;
  /** 一覧カードに出す本文の書き出し */
  excerpt: string;
  source: NoteSourceRef | null;
  createdAt: string;
  updatedAt: string;
}

export type NoteSort = 'updated' | 'created' | 'title';

export const NOTE_SORT_LABEL: Record<NoteSort, string> = {
  updated: '更新日順',
  created: '作成日順',
  title: 'タイトル順',
};

/** GET /webcoach/notes のクエリ */
export interface NoteListQuery {
  q?: string;
  sort?: NoteSort;
  favorite?: boolean;
  /** そのレッスンから触ったノートだけを引く（教材画面のメモ欄が使う） */
  lessonId?: number;
}

/** POST /webcoach/notes */
export interface NoteCreateInput {
  title?: string;
  source?: NoteSourceRef | null;
}

/** PATCH /webcoach/notes/:id */
export interface NoteUpdateInput {
  title?: string;
  favorite?: boolean;
}

/** POST /webcoach/notes/:id/blocks — kind ごとに必要なものだけ渡す */
export type NoteBlockInput =
  | { kind: 'text'; text: string }
  | { kind: 'clip'; text: string; source: NoteSourceRef }
  | {
      kind: 'answer';
      question: string;
      answer: string;
      selectedText?: string | null;
      image?: string | null;
      source?: NoteSourceRef | null;
    };

/** PATCH /webcoach/notes/:id/blocks/:blockId */
export interface NoteBlockPatch {
  text?: string;
  answer?: string;
}

/**
 * 教材画面がハイライトを描くためだけの軽量表現。
 * これが無いと、本文に <mark> を当てるためだけに全ノートの全ブロックを取りに行くことになる。
 */
export interface NoteClipRef {
  noteId: string;
  noteTitle: string;
  blockId: string;
  /** 教材ブロックのID */
  sourceBlockId: string;
  text: string;
  offset: number | null;
}
