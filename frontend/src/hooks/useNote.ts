import { useCallback, useEffect, useRef, useState } from 'react';
import bffClient from '../services/bffClient';
import { Note, NoteBlockInput, NoteBlockPatch } from '../types/notes';

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
  /** 本文にまだ保存していない変更があるか */
  dirty: boolean;
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
  /** まだ送っていない本文。null なら送るものが無い（保存の説明は saveBody） */
  const pendingBodyRef = useRef<string | null>(null);

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
      // 失敗からの巻き戻しでも、未保存の本文は画面に残す
      const pending = pendingBodyRef.current;
      setNote(pending !== null ? { ...data, body: pending } : data);
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
   * ────────── 本文の保存 ──────────
   * 🔴 自動保存（打つのを止めたら送る）はしない。「保存」ボタンか Ctrl+S で送る。
   *    contents は本文と素材の1列を丸ごと書き戻すので、打つたびに送ると
   *    別の画面（教材・AIコーチ）から足された素材との書き込みがぶつかりやすい。
   * 🔴 ただし書いたものは失わせない。別のノートへ切り替える・画面を離れるときに
   *    未保存の本文があれば、その場で送る（下の useEffect）。
   * 🔴 本文は全文で送る。部分更新の単位が無いので差分は作れない。
   */
  const [dirty, setDirty] = useState(false);

  /**
   * サーバが返したノートを取り込む。未保存の本文があるときは、
   * 画面の本文を返ってきた本文で巻き戻さない（タイトル変更などの往復で書いたものが消えるため）。
   */
  const adopt = useCallback((saved: Note) => {
    const pending = pendingBodyRef.current;
    setNote(pending !== null ? { ...saved, body: pending } : saved);
  }, []);

  /** 本文を打った。画面だけ変えて、保存はしない */
  const setBody = useCallback((next: string) => {
    setNote((prev) => (prev ? { ...prev, body: next } : prev));
    pendingBodyRef.current = next;
    setDirty(true);
  }, []);

  /** いま送っている本文。一覧へ戻る操作と画面を離れる後始末が同じ本文を二重に送らないため */
  const inFlightRef = useRef<string | null>(null);

  /** 未保存の本文を送る */
  const saveBody = useCallback(async () => {
    const text = pendingBodyRef.current;
    if (!noteId || text === null || inFlightRef.current === text) return;
    inFlightRef.current = text;
    try {
      const saved = await track(() => bffClient.updateNote(noteId, { body: text }));
      // 往復の間にさらに打っていたら、その分はまだ未保存のまま残す
      if (pendingBodyRef.current === text) {
        pendingBodyRef.current = null;
        setDirty(false);
      }
      /*
       * 🔴 返ってきたノートで本文を上書きしない。往復の間に打った文字が巻き戻る。
       *    素材（別の画面から足されたものを含む）と更新日だけ取り込む。
       */
      setNote((prev) =>
        prev && prev.id === saved.id ? { ...prev, blocks: saved.blocks, updatedAt: saved.updatedAt } : prev
      );
    } catch {
      // 🔴 reload() しない。巻き戻すと未保存の本文がそのまま消える。保存状態だけエラーにする
    } finally {
      inFlightRef.current = null;
    }
  }, [noteId, track]);

  // ノートを切り替える・画面を離れるときは、未保存の本文を送ってから離れる
  useEffect(
    () => () => {
      void saveBody();
      pendingBodyRef.current = null;
      setDirty(false);
    },
    [saveBody]
  );

  // タブを閉じる・再読み込みするときは、未保存があれば確認を出す
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  /** タイトルは打つたびに保存せず、確定（blur / Enter）で送る */
  const renameNote = useCallback(
    async (title: string) => {
      if (!noteId || !note || title === note.title) return;
      setNote({ ...note, title });
      try {
        adopt(await track(() => bffClient.updateNote(noteId, { title })));
      } catch {
        void reload();
      }
    },
    [noteId, note, reload, track, adopt]
  );

  const toggleFavorite = useCallback(async () => {
    if (!noteId || !note) return;
    const next = !note.favorite;
    setNote({ ...note, favorite: next });
    try {
      adopt(await track(() => bffClient.updateNote(noteId, { favorite: next })));
    } catch {
      void reload();
    }
  }, [noteId, note, reload, track, adopt]);

  /** フォルダを移す（上部バーのフォルダピル）。null で未整理へ */
  const moveToFolder = useCallback(
    async (folderId: string | null) => {
      if (!noteId || !note || folderId === note.folderId) return;
      setNote({ ...note, folderId });
      try {
        adopt(await track(() => bffClient.updateNote(noteId, { folderId })));
      } catch {
        void reload();
      }
    },
    [noteId, note, reload, track, adopt]
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
      setNote((prev) => (prev ? { ...prev, blocks: prev.blocks.filter((b) => b.id !== blockId) } : prev));
      try {
        await track(() => bffClient.deleteNoteBlock(noteId, blockId));
      } catch {
        void reload();
      }
    },
    [noteId, reload, track]
  );

  const saveState: NoteSaveState = { saving: savingCount > 0, lastSavedAt, error: saveError, dirty };

  return {
    note,
    loading,
    error,
    saveState,
    reload,
    renameNote,
    setBody,
    saveBody,
    toggleFavorite,
    moveToFolder,
    addBlock,
    patchBlock,
    removeBlock,
  };
}

export default useNote;
