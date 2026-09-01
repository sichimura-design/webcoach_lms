import { useCallback, useEffect, useRef, useState } from 'react';
import bffClient from '../services/bffClient';
import { Note, NoteBlockInput, NoteBlockInsert, NoteBlockPatch } from '../types/notes';
import { deleteNoteImage } from '../utils/noteImageStore';

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

  /** index を渡すとその位置に差し込む（ブロック間の ＋ から挿入するため） */
  const addBlock = useCallback(
    async (input: NoteBlockInput & NoteBlockInsert) => {
      if (!noteId) return null;
      try {
        const block = await bffClient.appendNoteBlock(noteId, input);
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
      // 画像ブロックなら IndexedDB の実体も落とす（消したのに容量が残るのを防ぐ）
      const target = note?.blocks.find((b) => b.id === blockId);
      setNote((prev) => (prev ? { ...prev, blocks: prev.blocks.filter((b) => b.id !== blockId) } : prev));
      try {
        await bffClient.deleteNoteBlock(noteId, blockId);
        if (target?.kind === 'image') void deleteNoteImage(target.imageId);
      } catch {
        void reload();
      }
    },
    [noteId, note, reload]
  );

  return { note, loading, error, reload, renameNote, toggleFavorite, addBlock, patchBlock, removeBlock };
}

export default useNote;
