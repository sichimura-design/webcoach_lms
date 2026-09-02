import { useCallback, useEffect, useRef, useState } from 'react';
import bffClient from '../services/bffClient';
import { NoteFolder } from '../types/notes';

/**
 * マイノートのフォルダ一覧（デザイン『マイノート 改善案』の左列）。
 *
 * 件数はここでは持たない。ノート一覧（useNoteList）は全件を手元に持っているので、
 * 画面側が items から数えるほうが、絞り込みと常に同じ数になる。
 */
export function useNoteFolders() {
  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 応答が前後しても最後のリクエストの結果だけを採る（useNoteList と同じ）
  const reqRef = useRef(0);

  const reload = useCallback(async () => {
    const seq = ++reqRef.current;
    setLoading(true);
    try {
      const list = await bffClient.listNoteFolders();
      if (seq !== reqRef.current) return;
      setFolders(list);
      setError(null);
    } catch {
      if (seq !== reqRef.current) return;
      setError('フォルダを読み込めませんでした');
    } finally {
      if (seq === reqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(
    async (name: string) => {
      const folder = await bffClient.createNoteFolder({ name });
      await reload();
      return folder;
    },
    [reload]
  );

  /** 名前の変更は楽観更新。失敗したら取り直して巻き戻す */
  const rename = useCallback(
    async (id: string, name: string) => {
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
      try {
        await bffClient.updateNoteFolder(id, { name });
      } catch (e) {
        await reload();
        throw e;
      }
    },
    [reload]
  );

  /** 削除。中のノートは未整理へ移る。moved はその件数（トースト用） */
  const remove = useCallback(
    async (id: string) => {
      const result = await bffClient.deleteNoteFolder(id);
      await reload();
      return result;
    },
    [reload]
  );

  return { folders, loading, error, reload, create, rename, remove };
}

export default useNoteFolders;
