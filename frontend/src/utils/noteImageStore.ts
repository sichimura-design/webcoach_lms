/**
 * ノートに貼った画像の置き場所（IndexedDB）。
 * ============================================================
 * 🔴 なぜ localStorage でも dataURL でもないのか。
 *    ノート本体（mocks/noteMigration.ts の webcoach-lesson-notes）は
 *    localStorage に入る。dataURL を本文に埋めると1枚で数MBになり、
 *    localStorage の 5MB 上限を数枚で超えてノートごと保存できなくなる。
 *    AIコーチで同じ失敗をしている（store/aiCoachStore.ts:27
 *    「画像（dataURL）は永続化しない。数MBになり sessionStorage を溢れさせる」）。
 *
 * 🔴 なぜ mocks/ ではなく utils/ なのか。
 *    NoteBlockView（本番ビルドにも入る）から読むため。mocks/ 配下は
 *    MOCKS_ENABLED=false のとき読み込まれない前提で書かれている。
 *    実APIになったら、ブロックが持つ imageId をサーバのURLに差し替えて
 *    このモジュールを捨てる。
 * ============================================================
 */

const DB_NAME = 'webcoach-note-images';
const DB_VERSION = 1;
const STORE = 'images';

/** 長辺の上限。これを超える写真は縮めて入れる（表示はノート幅700px程度） */
const MAX_EDGE = 1600;
/** 縮小せずそのまま入れる上限。これ以下なら元のフォーマットを保つ */
const KEEP_AS_IS_BYTES = 400 * 1024;

export const NOTE_IMAGE_MAX_BYTES = 12 * 1024 * 1024;
export const NOTE_IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  // 失敗したら次の呼び出しでやり直せるようにする（プライベートモード等）
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = run(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

function newId(): string {
  return `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 大きすぎる画像を縮める。canvas を通すので、透過PNGは白背景ではなく
 * PNG のまま出す（JPEGにすると透過が黒く潰れる）。
 * 失敗したら元のファイルをそのまま返す（縮小は最適化であって必須ではない）。
 */
async function shrink(file: File): Promise<Blob> {
  if (file.size <= KEEP_AS_IS_BYTES) return file;

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode failed'));
      el.src = url;
    });

    const longEdge = Math.max(img.naturalWidth, img.naturalHeight);
    if (longEdge <= MAX_EDGE && file.size <= 2 * 1024 * 1024) return file;

    const scale = Math.min(1, MAX_EDGE / longEdge);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, type === 'image/jpeg' ? 0.85 : undefined)
    );
    // 縮めたのに大きくなることがある（小さなPNGなど）。その場合は元を採る
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 画像を保存して参照キーを返す。ブロックにはこのキーだけを載せる */
export async function putNoteImage(file: File): Promise<string> {
  const blob = await shrink(file);
  const id = newId();
  await tx('readwrite', (store) => store.put(blob, id));
  return id;
}

/**
 * 表示用の URL を作る。呼び出し側が使い終わったら必ず revokeObjectURL する。
 * 見つからなければ null（localStorage だけ復元されて IndexedDB が空、など）。
 */
export async function getNoteImageUrl(imageId: string): Promise<string | null> {
  try {
    const blob = await tx<Blob | undefined>('readonly', (store) => store.get(imageId));
    return blob ? URL.createObjectURL(blob) : null;
  } catch {
    return null;
  }
}

/** ブロックを削除したときに呼ぶ。失敗しても無視する（残っても表示には影響しない） */
export async function deleteNoteImage(imageId: string): Promise<void> {
  try {
    await tx('readwrite', (store) => store.delete(imageId));
  } catch {
    /* noop */
  }
}
