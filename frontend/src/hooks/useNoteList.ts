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
      setError('ノートを読み込めませんでした');
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

  return { items, loading, error, query, setQuery, sort, setSort, reload, create, remove };
}

export default useNoteList;
