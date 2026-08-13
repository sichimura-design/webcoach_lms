import { useCallback, useEffect, useRef, useState } from 'react';
import { bffClient } from '../services/bffClient';

/**
 * 教材ページの「メモ下書き」。
 *
 * 🔴 下書きはノートではない。
 *    ノート（自由帳）は器＋ブロックで hooks/useNote.ts と useNoteList.ts が扱う。
 *    こちらはレッスンに1つだけ紐づく作業用のテキストで、打つそばから自動保存される。
 *    「編集してから残す」と「そのまま取り込む」は意図が違う操作なので統合しない。
 *
 * 以前はこのフックが一覧取得・作成・削除まで持っていたが、
 * ノートの作り替えでそれらは useNote / useNoteList / useNoteCapture へ移した。
 */
export interface UseNotes {
  /** 教材単位のメモ下書き。入力のたびにデバウンス保存される */
  memoDraft: string;
  setMemoDraft: (text: string) => void;
  memoStatus: 'idle' | 'saving' | 'saved';
  /** AI回答を下書きへ追記する（編集してから残したいとき用） */
  appendToMemo: (question: string, answer: string) => void;
}

const AUTOSAVE_DELAY_MS = 500;

export interface UseNotesOptions {
  /** 教材単位のメモを読み書きする対象 */
  lessonId?: number | null;
}

export function useNotes(options: UseNotesOptions = {}): UseNotes {
  const { lessonId = null } = options;

  const [memoDraft, setMemoDraftState] = useState('');
  const [memoStatus, setMemoStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!lessonId) return;
    let cancelled = false;
    bffClient
      .getLessonMemo(lessonId)
      .then((res) => {
        if (!cancelled) {
          setMemoDraftState(res.text ?? '');
          setMemoStatus('idle');
        }
      })
      .catch(() => {
        if (!cancelled) setMemoDraftState('');
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId]);

  // アンマウント時に保留中の保存タイマーを片付ける
  useEffect(
    () => () => {
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    },
    []
  );

  const setMemoDraft = useCallback(
    (text: string) => {
      setMemoDraftState(text);
      if (!lessonId) return;
      setMemoStatus('saving');
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        bffClient
          .putLessonMemo(lessonId, text)
          .then(() => setMemoStatus('saved'))
          .catch(() => setMemoStatus('idle'));
      }, AUTOSAVE_DELAY_MS);
    },
    [lessonId]
  );

  const appendToMemo = useCallback(
    (question: string, answer: string) => {
      const block = `\n\n── AIコーチから追加 ──\nQ. ${question}\n${answer}\n──\n`;
      setMemoDraft(`${memoDraft.trimEnd()}${block}`);
    },
    [memoDraft, setMemoDraft]
  );

  return { memoDraft, setMemoDraft, memoStatus, appendToMemo };
}
