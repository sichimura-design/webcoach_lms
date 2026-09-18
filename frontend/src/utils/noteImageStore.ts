/**
 * ノートに貼った画像の置き場所（IndexedDB）。**読み出しと削除だけ**。
 * ============================================================
 * 🔴 putNoteImage（ファイルを受け取って保存する関数）と、それが使っていた
 *    縮小処理・NOTE_IMAGE_MAX_BYTES・NOTE_IMAGE_ACCEPT は削除した。
 *    受講生が任意の画像をアプリに持ち込める口を持たない、というセキュリティ方針。
 *    実BFFに画像アップロードAPIは無く、選んだファイルは検証されないまま
 *    ブラウザ内（IndexedDB）に溜まるだけだった。
 *    **足し直さないこと。** 必要になったら、サーバ側で種別・サイズ・保存先を
 *    決める専用エンドポイントを先に用意する（profile のアイコンで同じ判断をしている。
 *    services/bffClient.ts の uploadProfileAvatar の抜け殻コメント参照）。
 *
 * 🔴 読み出し（getNoteImageUrl）と削除（deleteNoteImage）は残す。
 *    禁止より前に貼られた画像が既存ノートに入っているので、
 *    表示できなくなると過去のノートが壊れる。消す手段も要る。
 *
 * 🔴 なぜ localStorage でも dataURL でもないのか（既存データの形の理由）。
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
