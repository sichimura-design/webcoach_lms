import { useCallback, useEffect, useRef, useState } from 'react';
import bffClient from '../services/bffClient';
import { Note, NoteBlockInput, NoteBlockPatch } from '../types/notes';

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

  /** タイトルは打つたびに保存せず、確定（blur / Enter）で送る */
  const renameNote = useCallback(
    async (title: string) => {
      if (!noteId || !note || title === note.title) return;
      setNote({ ...note, title });
      try {
        setNote(await bffClient.updateNote(noteId, { title }));
      } catch {
        void reload();
      }
    },
    [noteId, note, reload]
  );

  const toggleFavorite = useCallback(async () => {
    if (!noteId || !note) return;
    const next = !note.favorite;
    setNote({ ...note, favorite: next });
    try {
      setNote(await bffClient.updateNote(noteId, { favorite: next }));
    } catch {
      void reload();
    }
  }, [noteId, note, reload]);

  const addBlock = useCallback(
    async (input: NoteBlockInput) => {
      if (!noteId) return null;
      try {
        const block = await bffClient.appendNoteBlock(noteId, input);
        setNote((prev) => (prev ? { ...prev, blocks: [...prev.blocks, block] } : prev));
        return block;
      } catch {
        void reload();
        return null;
      }
    },
    [noteId, reload]
  );

  const patchBlock = useCallback(
    async (blockId: string, patch: NoteBlockPatch) => {
      if (!noteId) return;
      // 先に画面へ反映する。textarea から抜けた瞬間に元の文へ戻るのを避ける
      setNote((prev) =>
        prev
          ? {
              ...prev,
              blocks: prev.blocks.map((b) =>
                b.id !== blockId
                  ? b
                  : b.kind === 'answer'
                    ? { ...b, answer: patch.answer ?? b.answer }
                    : { ...b, text: patch.text ?? b.text }
              ),
            }
          : prev
      );
      try {
        await bffClient.updateNoteBlock(noteId, blockId, patch);
      } catch {
        void reload();
      }
    },
    [noteId, reload]
  );

  const removeBlock = useCallback(
    async (blockId: string) => {
      if (!noteId) return;
      setNote((prev) => (prev ? { ...prev, blocks: prev.blocks.filter((b) => b.id !== blockId) } : prev));
      try {
        await bffClient.deleteNoteBlock(noteId, blockId);
      } catch {
        void reload();
      }
    },
    [noteId, reload]
  );

  return { note, loading, error, reload, renameNote, toggleFavorite, addBlock, patchBlock, removeBlock };
}

export default useNote;
