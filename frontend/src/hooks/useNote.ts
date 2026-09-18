import { useCallback, useEffect, useRef, useState } from 'react';
import bffClient from '../services/bffClient';
import { Note, NoteBlockInput, NoteBlockPatch } from '../types/notes';
import { deleteNoteImage } from '../utils/noteImageStore';

/**
 * ノート面の上部バーに出す保存状態（デザイン『マイノート 改善案』③）。
 * 以前は「更新日」しか手がかりが無く、書いたものが残ったのか画面から読めなかった。
 */
export interface NoteSaveState {
  /** 進行中の保存が1つでもあるか */
  saving: boolean;
  /** 最後に保存が成功した時刻（ISO）。まだ何も保存していなければ null */
  lastSavedAt: string | null;
  /** 直近の保存が失敗したときの文言。次に成功したら消える */
  error: string | null;
}

/**
 * ノート1件の読み書き。
 *
 * ブロックの追加・編集・削除は楽観更新する。自由帳として書いている最中に
 * 毎回サーバ往復の待ちが入ると、書く手が止まってしまうため。
 * 失敗したら取り直して巻き戻す。
 */
export function useNote(noteId: string | null) {
  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reqRef = useRef(0);

  // 保存状態。同時に走る保存があるので件数で持つ（boolean だと先に終わった方が消してしまう）
  const [savingCount, setSavingCount] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  /** bffClient への書き込みを1つ包んで、保存状態を進める */
  const track = useCallback(async <T,>(run: () => Promise<T>): Promise<T> => {
    setSavingCount((c) => c + 1);
    try {
      const result = await run();
      setLastSavedAt(new Date().toISOString());
      setSaveError(null);
      return result;
    } catch (e) {
      setSaveError('保存できませんでした');
      throw e;
    } finally {
      setSavingCount((c) => Math.max(0, c - 1));
    }
  }, []);

  const reload = useCallback(async () => {
    if (!noteId) {
      setNote(null);
      return;
    }
    const seq = ++reqRef.current;
    setLoading(true);
    try {
      const data = await bffClient.getNote(noteId);
      if (seq !== reqRef.current) return;
      setNote(data);
      setError(null);
    } catch {
      if (seq !== reqRef.current) return;
      setNote(null);
      setError('ノートを開けませんでした');
    } finally {
      if (seq === reqRef.current) setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // 別のノートを開いたら保存状態も持ち越さない
  useEffect(() => {
    setLastSavedAt(null);
    setSaveError(null);
  }, [noteId]);

  /*
   * ────────── 本文の自動保存 ──────────
   * 🔴 「保存する」ボタンは無い。打った手が止まったら勝手に送る。
   *    v5 までは1段落ごとに「保存する」を押してブロックを確定させる作りで、
   *    「一行書くのにこんな保存方法が要るのか」という指摘で撤去した。
   * 🔴 本文は全文で送る。部分更新の単位が無いので差分は作れない。
   */
  const bodyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** まだ送っていない本文。null なら送るものが無い */
  const pendingBodyRef = useRef<string | null>(null);

  const sendBody = useCallback(async () => {
    const text = pendingBodyRef.current;
    if (!noteId || text === null) return;
    pendingBodyRef.current = null;
    try {
      const saved = await track(() => bffClient.updateNote(noteId, { body: text }));
      /*
       * 🔴 返ってきたノートで setNote しない。保存中も打ち続けているので、
       *    往復の間に打った文字がレスポンスで巻き戻る。更新日だけ取り込む。
       */
      setNote((prev) => (prev ? { ...prev, updatedAt: saved.updatedAt } : prev));
    } catch {
      /*
       * 🔴 ここで reload() しない。他の操作と違い、巻き戻すと「いま打った本文」が
       *    そのまま消える。画面の文字は残したまま保存状態だけエラーにして、
       *    次の入力でもう一度送る（保存状態は上部バーが出す）。
       */
      pendingBodyRef.current = text;
    }
  }, [noteId, track]);

  /** 本文を打った。画面は即時、保存は 800ms 後 */
  const setBody = useCallback(
    (next: string) => {
      setNote((prev) => (prev ? { ...prev, body: next } : prev));
      pendingBodyRef.current = next;
      if (bodyTimer.current) clearTimeout(bodyTimer.current);
      bodyTimer.current = setTimeout(() => void sendBody(), 800);
    },
    [sendBody]
  );

  /** 待たずに送る（textarea から抜けたとき） */
  const flushBody = useCallback(() => {
    if (bodyTimer.current) {
      clearTimeout(bodyTimer.current);
      bodyTimer.current = null;
    }
    void sendBody();
  }, [sendBody]);

  // ノートを切り替える・画面を離れるときは、待ち時間を待たずに送る
  useEffect(
    () => () => {
      if (bodyTimer.current) clearTimeout(bodyTimer.current);
      void sendBody();
    },
    [sendBody]
  );

  /** タイトルは打つたびに保存せず、確定（blur / Enter）で送る */
  const renameNote = useCallback(
    async (title: string) => {
      if (!noteId || !note || title === note.title) return;
      setNote({ ...note, title });
      try {
        setNote(await track(() => bffClient.updateNote(noteId, { title })));
      } catch {
        void reload();
      }
    },
    [noteId, note, reload, track]
  );

  const toggleFavorite = useCallback(async () => {
    if (!noteId || !note) return;
    const next = !note.favorite;
    setNote({ ...note, favorite: next });
    try {
      setNote(await track(() => bffClient.updateNote(noteId, { favorite: next })));
    } catch {
      void reload();
    }
  }, [noteId, note, reload, track]);

  /** フォルダを移す（上部バーのフォルダピル）。null で未整理へ */
  const moveToFolder = useCallback(
    async (folderId: string | null) => {
      if (!noteId || !note || folderId === note.folderId) return;
      setNote({ ...note, folderId });
      try {
        setNote(await track(() => bffClient.updateNote(noteId, { folderId })));
      } catch {
        void reload();
      }
    },
    [noteId, note, reload, track]
  );

  /** 素材（クリップ / AI回答）を末尾に足す。本文は saveBody が受け持つ */
  const addBlock = useCallback(
    async (input: NoteBlockInput) => {
      if (!noteId) return null;
      try {
        const block = await track(() => bffClient.appendNoteBlock(noteId, input));
        setNote((prev) => (prev ? { ...prev, blocks: [...prev.blocks, block] } : prev));
        return block;
      } catch {
        void reload();
        return null;
      }
    },
    [noteId, reload, track]
  );

  const patchBlock = useCallback(
    async (blockId: string, patch: NoteBlockPatch) => {
      if (!noteId) return;
      // 先に画面へ反映する。textarea から抜けた瞬間に元の文へ戻るのを避ける
      setNote((prev) =>
        prev
          ? {
              ...prev,
              blocks: prev.blocks.map((b) => {
                if (b.id !== blockId) return b;
                if (b.kind === 'answer') return { ...b, answer: patch.answer ?? b.answer };
                if (b.kind === 'image') {
                  return { ...b, caption: patch.caption !== undefined ? patch.caption : b.caption };
                }
                return { ...b, text: patch.text ?? b.text };
              }),
            }
          : prev
      );
      try {
        await track(() => bffClient.updateNoteBlock(noteId, blockId, patch));
      } catch {
        void reload();
      }
    },
    [noteId, reload, track]
  );

  const removeBlock = useCallback(
    async (blockId: string) => {
      if (!noteId) return;
      // 画像ブロックなら IndexedDB の実体も落とす（消したのに容量が残るのを防ぐ）
      const target = note?.blocks.find((b) => b.id === blockId);
      setNote((prev) => (prev ? { ...prev, blocks: prev.blocks.filter((b) => b.id !== blockId) } : prev));
      try {
        await track(() => bffClient.deleteNoteBlock(noteId, blockId));
        if (target?.kind === 'image') void deleteNoteImage(target.imageId);
      } catch {
        void reload();
      }
    },
    [noteId, note, reload, track]
  );

  const saveState: NoteSaveState = { saving: savingCount > 0, lastSavedAt, error: saveError };

  return {
    note,
    loading,
    error,
    saveState,
    reload,
    renameNote,
    setBody,
    flushBody,
    toggleFavorite,
    moveToFolder,
    addBlock,
    patchBlock,
    removeBlock,
  };
}

export default useNote;
