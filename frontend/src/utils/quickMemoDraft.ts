/**
 * 速記メモ（PiP小窓）の書きかけの置き場所。
 * ============================================================
 * 🔴 なぜ MSW のAPIを足さないのか。
 *    これはAPIで扱うデータではなく、textarea の未確定値そのもの。
 *    残すと決めた分は「ノートに追加」で NoteBlock になり、そちらは
 *    既存の bffClient.appendNoteBlock（mocks/noteHandlers.ts）を通る。
 *    ここに残るのは、まだノートにしていない途中の文字だけ。
 *
 * 🔴 なぜ mocks/noteMigration.ts のストアに相乗りしないのか。
 *    readNoteStore() は return する経路すべてでフィールドを明示列挙していて、
 *    知らないトップレベルのキーは黙って捨てる。1経路でも書き漏らすと
 *    「保存したのにリロードで消える」という再現しづらいバグになる。
 *    データ変換の要らない項目のために、あのファイルを触る価値はない。
 *    同期で書けることも利点で、アンマウントの片付けから確実に間に合う。
 *
 * 🔴 なぜ mocks/ ではなく utils/ なのか。
 *    utils/noteImageStore.ts と同じ理由。本番ビルドにも入る画面から読むため。
 *    実APIになったら、下書きもサーバに置くか、この機能ごとこのモジュールを捨てる。
 *
 * 🔴 キーは転記先ごとに分ける。
 *    ひとつのグローバルな下書きにすると、コーチング中に書き残した文字が、
 *    後日 /notes で小窓を開いたときに別のノート宛てとして復元されてしまう。
 * ============================================================
 */

const STORAGE_KEY = 'webcoach-quick-memo';

/** これより古い書きかけは読み捨てる。溜め込んでも復元されて混乱するだけ */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

interface DraftEntry {
  text: string;
  updatedAt: string;
}

type DraftStore = Record<string, DraftEntry>;

/** コーチングの回に紐づく下書き */
export const coachingDraftKey = (sessionId: string) => `coaching:${sessionId}`;
/** 特定のノートに書き足すための下書き */
export const noteDraftKey = (noteId: string) => `note:${noteId}`;

function readStore(): DraftStore {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return {};
  }
  if (!raw) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

  const limit = Date.now() - MAX_AGE_MS;
  const store: DraftStore = {};
  Object.entries(parsed as Record<string, unknown>).forEach(([key, value]) => {
    if (!value || typeof value !== 'object') return;
    const entry = value as Partial<DraftEntry>;
    if (typeof entry.text !== 'string' || !entry.text) return;
    const at = Date.parse(entry.updatedAt ?? '');
    if (Number.isNaN(at) || at < limit) return;
    store[key] = { text: entry.text, updatedAt: entry.updatedAt as string };
  });
  return store;
}

function writeStore(store: DraftStore) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* 容量やプライベートモード。下書きのために画面を壊さない */
  }
}

export function readQuickMemoDraft(key: string): string {
  return readStore()[key]?.text ?? '';
}

/** 空文字を渡すとその下書きを片付ける（空のまま残しておく意味がない） */
export function writeQuickMemoDraft(key: string, text: string) {
  const store = readStore();
  if (text.trim() === '') {
    if (!(key in store)) return;
    delete store[key];
  } else {
    store[key] = { text, updatedAt: new Date().toISOString() };
  }
  writeStore(store);
}

export function clearQuickMemoDraft(key: string) {
  writeQuickMemoDraft(key, '');
}
