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
export type NoteBlockKind = 'text' | 'clip' | 'answer' | 'image';

export const NOTE_BLOCK_LABEL: Record<NoteBlockKind, string> = {
  text: '本文',
  clip: 'クリップ',
  answer: 'AI回答',
  image: '画像',
};

/**
 * ノートの出どころ。CONTENTS §16-4 の「自動付与」。
 * 作った場所で一度決まり、以後は変わらない（あとから中身が増えても付け替えない）。
 * 一覧のバッジと絞り込みチップの根拠。
 *
 * self     … 「新しいノートを作成」から自分で作った
 * material … 教材（レッスン）から作られた
 * ai       … AIコーチの回答を残すために作られた
 * coaching … 面談のまとめ。coachingSessionId でどの回のものかが分かる
 *             （ノート作成の導線自体はまだ無く、シードで入っているだけ）
 */
export type NoteOrigin = 'self' | 'material' | 'ai' | 'coaching';

export const NOTE_ORIGIN_LABEL: Record<NoteOrigin, string> = {
  self: '自分のメモ',
  material: '教材',
  ai: 'AIコーチ',
  coaching: 'コーチング',
};

/**
 * フォルダ。デザイン『マイノート 改善案』で足した「自分で決める入れ物」。
 * 出どころ（origin）は自動で付くラベル、フォルダは手で選ぶ置き場所、と軸が違う。
 * 階層は持たない（1段だけ）。フォルダに入っていないノートは「未整理」に見える。
 */
export interface NoteFolder {
  id: string;
  name: string;
  createdAt: string;
}

/** フォルダの名前の上限。列の幅（248px）に1行で収まる長さ */
export const NOTE_FOLDER_NAME_MAX = 40;

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

/**
 * 自分で貼った画像。
 * 🔴 画像の中身はここに持たない。`imageId` は IndexedDB
 *    （utils/noteImageStore.ts）の参照キーで、ノート本体は localStorage に
 *    入るため、dataURL を持たせると数枚で容量上限を超える
 *    （store/aiCoachStore.ts:27 で同じ失敗をしている）。
 *    実APIになったら imageId をサーバのURLに置き換える。
 */
export interface NoteImageBlock extends NoteBlockBase {
  kind: 'image';
  imageId: string;
  /** 読み上げ用。ファイル名を既定にする */
  alt: string;
  /** 画像の下に出す説明。未入力は null */
  caption: string | null;
}

export type NoteBlock = NoteTextBlock | NoteClipBlock | NoteAnswerBlock | NoteImageBlock;

export interface Note {
  id: string;
  title: string;
  blocks: NoteBlock[];
  /**
   * 一覧のラベル「重要」。手で付けるラベルはこれ1種だけ。
   * フォルダ（folderId）はラベルではなく置き場所で、別の軸として持つ。
   */
  favorite: boolean;
  origin: NoteOrigin;
  /** 入っているフォルダ。null は「未整理」（取り込んだものが最初に入る場所） */
  folderId: string | null;
  /**
   * レッスンから作られたノートの出どころ。
   * 「新しいノートを作成」から作ったものは null。
   * ノート面のメタ行「Webデザイン入門 / Lesson 4」はこれを描く。
   */
  source: NoteSourceRef | null;
  /**
   * このノートを取ったコーチング回（CoachingSessionDetail.id）。
   * コーチング記録の「自分のメモ」がこれで自分の回のノートを引く。
   * source は教材（courseId / lessonId）専用なので、そちらには相乗りできない。
   */
  coachingSessionId?: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 一覧に出す軽量表現。ブロック全部を持たせると一覧の取得が重くなる */
export interface NoteSummary {
  id: string;
  title: string;
  favorite: boolean;
  origin: NoteOrigin;
  folderId: string | null;
  blockCount: number;
  /** 一覧カードに出す本文の書き出し */
  excerpt: string;
  source: NoteSourceRef | null;
  coachingSessionId?: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * 一覧の並び順。
 * 🔴 昇順（古い順）を必ず持たせる。「最初に書いたノートから読み返す」は
 *    振り返りの基本動作で、降順3種だけでは辿れない。
 */
export type NoteSort = 'updated' | 'updatedAsc' | 'created' | 'createdAsc' | 'title';

export const NOTE_SORT_LABEL: Record<NoteSort, string> = {
  updated: '更新が新しい順',
  updatedAsc: '更新が古い順',
  created: '作成が新しい順',
  createdAsc: '作成が古い順',
  title: 'タイトル順',
};

/** GET /webcoach/notes のクエリ */
export interface NoteListQuery {
  q?: string;
  sort?: NoteSort;
  favorite?: boolean;
  /** そのレッスンから触ったノートだけを引く（教材画面のメモ欄が使う） */
  lessonId?: number;
  /** そのコーチング回のノートだけを引く（コーチング記録の「自分のメモ」が使う） */
  coachingSessionId?: number;
}

/** POST /webcoach/notes */
export interface NoteCreateInput {
  title?: string;
  source?: NoteSourceRef | null;
  /** 省略時は source の有無から material / self を決める */
  origin?: NoteOrigin;
  coachingSessionId?: number | null;
  /** 省略時は未整理（null）。一覧でフォルダを開いた状態から作ると、そのフォルダに入る */
  folderId?: string | null;
}

/** PATCH /webcoach/notes/:id */
export interface NoteUpdateInput {
  title?: string;
  favorite?: boolean;
  /** フォルダの移動。null で未整理へ。移動だけなら updatedAt は上がらない */
  folderId?: string | null;
}

/** POST /webcoach/note-folders */
export interface NoteFolderCreateInput {
  name: string;
}

/** PATCH /webcoach/note-folders/:id */
export interface NoteFolderUpdateInput {
  name?: string;
}

/**
 * 一覧の左列で選ぶ「どこを見ているか」。
 * all/favorite は集計ビュー、inbox は folderId=null、folder は1フォルダ。
 * URL の ?folder= に載せる（all は省略、favorite は star）。
 */
export type NoteFolderFilter =
  | { kind: 'all' }
  | { kind: 'favorite' }
  | { kind: 'inbox' }
  | { kind: 'folder'; id: string };

export function parseFolderParam(raw: string | null): NoteFolderFilter {
  if (!raw) return { kind: 'all' };
  if (raw === 'star') return { kind: 'favorite' };
  if (raw === 'inbox') return { kind: 'inbox' };
  return { kind: 'folder', id: raw };
}

export function folderParamOf(filter: NoteFolderFilter): string | null {
  if (filter.kind === 'all') return null;
  if (filter.kind === 'favorite') return 'star';
  if (filter.kind === 'inbox') return 'inbox';
  return filter.id;
}

/** 一覧の1件がフィルタに入るか（フォルダ軸だけ。種類は別に掛ける） */
export function matchesFolderFilter(
  note: Pick<NoteSummary, 'favorite' | 'folderId'>,
  filter: NoteFolderFilter
): boolean {
  if (filter.kind === 'all') return true;
  if (filter.kind === 'favorite') return note.favorite;
  if (filter.kind === 'inbox') return note.folderId === null;
  return note.folderId === filter.id;
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
    }
  | { kind: 'image'; imageId: string; alt?: string; caption?: string | null };

/**
 * 挿入位置。省略すると末尾。
 * ブロックの間の ＋ から差し込むために要る（`order` 列は持たず、配列の順序が正）。
 */
export interface NoteBlockInsert {
  index?: number;
}

/** PATCH /webcoach/notes/:id/blocks/:blockId */
export interface NoteBlockPatch {
  text?: string;
  answer?: string;
  /** 画像ブロックの説明文 */
  caption?: string | null;
  /** 並べ替え。この位置へ動かす（ノート面の ⠿）。範囲外は端に寄せる */
  index?: number;
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
