import { useCallback, useEffect, useRef, useState } from 'react';
import bffClient from '../services/bffClient';
import { Note, NoteBlockInput, NoteBlockInsert, NoteBlockPatch } from '../types/notes';
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

  /** index を渡すとその位置に差し込む（ブロック間の ＋ から挿入するため） */
  const addBlock = useCallback(
    async (input: NoteBlockInput & NoteBlockInsert) => {
      if (!noteId) return null;
      try {
        const block = await track(() => bffClient.appendNoteBlock(noteId, input));
        setNote((prev) => {
          if (!prev) return prev;
          const blocks = [...prev.blocks];
          const at = input.index;
          if (typeof at === 'number' && at >= 0 && at < blocks.length) blocks.splice(at, 0, block);
          else blocks.push(block);
          return { ...prev, blocks };
        });
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

  /** 並べ替え（ノート面の ⠿）。楽観的に入れ替えてから送る。範囲外は端に寄せる */
  const moveBlock = useCallback(
    async (blockId: string, toIndex: number) => {
      if (!noteId || !note) return;
      const from = note.blocks.findIndex((b) => b.id === blockId);
      if (from < 0) return;
      const to = Math.max(0, Math.min(note.blocks.length - 1, toIndex));
      if (to === from) return;
      const blocks = [...note.blocks];
      const [moved] = blocks.splice(from, 1);
      blocks.splice(to, 0, moved);
      setNote({ ...note, blocks });
      try {
        await track(() => bffClient.updateNoteBlock(noteId, blockId, { index: to }));
      } catch {
        void reload();
      }
    },
    [noteId, note, reload, track]
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
    toggleFavorite,
    moveToFolder,
    addBlock,
    patchBlock,
    moveBlock,
    removeBlock,
  };
}

export default useNote;
