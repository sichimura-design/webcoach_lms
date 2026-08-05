import { useCallback, useEffect, useRef, useState } from 'react';
import { bffClient } from '../services/bffClient';
import { NoteCreateInput, NoteItem, NoteListQuery } from '../types/notes';

/**
 * メモ・クリップ・⭐保存したAI回答。
 *
 * 教材単位のメモ下書き（自動保存）と、保存物の一覧をまとめて扱う。
 * 一覧はマイノートページからも同じフックで使えるよう、lessonId は任意にしてある。
 */
export interface UseNotes {
  items: NoteItem[];
  loading: boolean;
  /** 教材単位のメモ下書き。入力のたびにデバウンス保存される */
  memoDraft: string;
  setMemoDraft: (text: string) => void;
  memoStatus: 'idle' | 'saving' | 'saved';
  addMemoCard: () => Promise<void>;
  createNote: (input: NoteCreateInput) => Promise<NoteItem | null>;
  /** AI回答をメモ下書きへ追記する（編集可能なブロックとして取り込む） */
  appendToMemo: (question: string, answer: string) => void;
  remove: (id: string) => Promise<void>;
  refetch: () => void;
}

const AUTOSAVE_DELAY_MS = 500;

export interface UseNotesOptions {
  /** 教材単位のメモを読み書きする対象。マイノートページでは省略する */
  lessonId?: number | null;
  /** 一覧の絞り込み。マイノートページから渡す */
  query?: NoteListQuery;
  /** メモ下書きを扱うか。マイノートページでは false */
  withMemoDraft?: boolean;
  /** メモカード化に必要な教材メタ情報 */
  context?: {
    courseId: number;
    courseName: string;
    lessonId: number;
    lessonTitle: string;
    heading: string | null;
  };
}

export function useNotes(options: UseNotesOptions = {}): UseNotes {
  const { lessonId = null, query, withMemoDraft = false, context } = options;

  const [items, setItems] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [memoDraft, setMemoDraftState] = useState('');
  const [memoStatus, setMemoStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [nonce, setNonce] = useState(0);

  const saveTimer = useRef<number | null>(null);
  // 一覧クエリはオブジェクトなので、値が同じでも毎回参照が変わる。
  // 依存配列に直接入れると無限ループになるため、文字列化して比較する。
  const queryKey = JSON.stringify(query ?? {});

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    bffClient
      .listNotes(JSON.parse(queryKey))
      .then((list) => { if (!cancelled) { setItems(list); setLoading(false); } })
      .catch(() => { if (!cancelled) { setItems([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [queryKey, nonce]);

  // 教材単位のメモ下書きを読み込む
  useEffect(() => {
    if (!withMemoDraft || !lessonId) return;
    let cancelled = false;
    bffClient
      .getLessonMemo(lessonId)
      .then((res) => { if (!cancelled) { setMemoDraftState(res.text ?? ''); setMemoStatus('idle'); } })
      .catch(() => { if (!cancelled) setMemoDraftState(''); });
    return () => { cancelled = true; };
  }, [withMemoDraft, lessonId]);

  // アンマウント時に保留中の保存タイマーを片付ける
  useEffect(() => () => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
  }, []);

  const setMemoDraft = useCallback(
    (text: string) => {
      setMemoDraftState(text);
      if (!withMemoDraft || !lessonId) return;
      setMemoStatus('saving');
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        bffClient
          .putLessonMemo(lessonId, text)
          .then(() => setMemoStatus('saved'))
          .catch(() => setMemoStatus('idle'));
      }, AUTOSAVE_DELAY_MS);
    },
    [withMemoDraft, lessonId]
  );

  const createNote = useCallback(async (input: NoteCreateInput): Promise<NoteItem | null> => {
    try {
      const created = await bffClient.createNote(input);
      setItems((prev) => [created, ...prev]);
      return created;
    } catch {
      return null;
    }
  }, []);

  const addMemoCard = useCallback(async () => {
    const text = memoDraft.trim();
    if (!text || !context) return;
    await createNote({
      kind: 'memo',
      courseId: context.courseId,
      courseName: context.courseName,
      lessonId: context.lessonId,
      lessonTitle: context.lessonTitle,
      blockId: null,
      heading: context.heading,
      text,
      question: null,
      selectedText: null,
      image: null,
      offset: null,
    });
    setMemoDraft('');
  }, [memoDraft, context, createNote, setMemoDraft]);

  const appendToMemo = useCallback(
    (question: string, answer: string) => {
      const block = `\n\n── AIコーチから追加 ──\nQ. ${question}\n${answer}\n──\n`;
      setMemoDraft(`${memoDraft.trimEnd()}${block}`);
    },
    [memoDraft, setMemoDraft]
  );

  const remove = useCallback(async (id: string) => {
    try {
      await bffClient.deleteNote(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch {
      /* 失敗しても一覧は変えない */
    }
  }, []);

  return {
    items,
    loading,
    memoDraft,
    setMemoDraft,
    memoStatus,
    addMemoCard,
    createNote,
    appendToMemo,
    remove,
    refetch,
  };
}
