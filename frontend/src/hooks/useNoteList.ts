import { useCallback, useEffect, useRef, useState } from 'react';
import bffClient from '../services/bffClient';
import { NoteCreateInput, NoteSort, NoteSummary } from '../types/notes';

/**
 * ノート一覧（検索・並び替え・作成・削除）。
 *
 * 一覧は NoteSummary（ブロックを持たない軽量表現）だけを扱う。
 * 本文の読み書きは useNote が受け持つ。
 */
interface UseNoteListOptions {
  /** そのレッスンから触ったノートだけに絞る（教材画面のメモ欄が使う） */
  lessonId?: number;
}

export function useNoteList({ lessonId }: UseNoteListOptions = {}) {
  const [items, setItems] = useState<NoteSummary[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<NoteSort>('updated');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 打つたびに投げない。useNotes.ts と同じ 500ms の間合いに揃える
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 500);
    return () => window.clearTimeout(timer);
  }, [query]);

  // 応答が前後しても最後のリクエストの結果だけを採る
  const reqRef = useRef(0);

  const reload = useCallback(async () => {
    const seq = ++reqRef.current;
    setLoading(true);
    try {
      const list = await bffClient.listNotes({ q: debouncedQuery || undefined, sort, lessonId });
      if (seq !== reqRef.current) return;
      setItems(list);
      setError(null);
    } catch {
      if (seq !== reqRef.current) return;
      setError('マイノートを読み込めませんでした');
    } finally {
      if (seq === reqRef.current) setLoading(false);
    }
  }, [debouncedQuery, sort, lessonId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(
    async (input: NoteCreateInput = {}) => {
      const note = await bffClient.createNote(input);
      await reload();
      return note;
    },
    [reload]
  );

  const remove = useCallback(
    async (id: string) => {
      await bffClient.deleteNote(id);
      await reload();
    },
    [reload]
  );

  /**
   * フォルダへ移す（カード下部のフォルダ名から選んだとき）。
   * 先に手元の一覧を書き換え、成功しても全体を取り直さない。移動では updatedAt が
   * 動かないので並びは変わらず、取り直すと選んだ直後にグリッドがちらつくだけ。
   * 失敗したら取り直して巻き戻し、呼び出し側にトーストを出させる。
   */
  const moveToFolder = useCallback(
    async (id: string, folderId: string | null) => {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, folderId } : n)));
      try {
        await bffClient.updateNote(id, { folderId });
      } catch (e) {
        await reload();
        throw e;
      }
    },
    [reload]
  );

  /**
   * 一覧のカードの★。moveToFolder と同じで、先に手元を書き換えてから送る。
   * 重要の切り替えでは updatedAt が動かない（mocks/noteHandlers.ts）ので並びは変わらず、
   * 取り直すとグリッドがちらつくだけなので成功時は再取得しない。
   */
  const toggleFavorite = useCallback(
    async (id: string, favorite: boolean) => {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, favorite } : n)));
      try {
        await bffClient.updateNote(id, { favorite });
      } catch (e) {
        await reload();
        throw e;
      }
    },
    [reload]
  );

  /**
   * ノート面（useNote）で変えたものを一覧にも映す。サーバには送らない。
   * ノート面から一覧に戻った瞬間にバーの件数が合っていないと、重要やフォルダを
   * 変えたことが「効いていない」ように見える。
   */
  const patchItem = useCallback((id: string, patch: Partial<Pick<NoteSummary, 'title' | 'favorite' | 'folderId'>>) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  }, []);

  return {
    items,
    loading,
    error,
    query,
    setQuery,
    sort,
    setSort,
    reload,
    create,
    remove,
    moveToFolder,
    toggleFavorite,
    patchItem,
  };
}

export default useNoteList;
