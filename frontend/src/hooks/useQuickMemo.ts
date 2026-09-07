import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearQuickMemoDraft,
  readQuickMemoDraft,
  writeQuickMemoDraft,
} from '../utils/quickMemoDraft';

/**
 * 速記メモ（PiP小窓）の書きかけ。
 *
 * 🔴 これはノートでも、教材のメモ下書き（hooks/useNotes.ts）でもない。
 *    useNotes はレッスン1件に紐づく作業テキストで、MSW経由でノートストアの
 *    memos に入る。こちらは「小窓に打ちかけの文字」で、転記先ごとに分かれ、
 *    localStorage に直接置く（utils/quickMemoDraft.ts に理由）。
 *    残すと決めた分だけが appendNoteBlock で本物のノートになる。
 *
 * 保存の間隔は useNotes.ts:24 と同じ 500ms に揃えてある。
 */
export interface UseQuickMemo {
  text: string;
  setText: (text: string) => void;
  status: 'idle' | 'saving' | 'saved';
  /** 保留中の保存を今すぐ書き込む。小窓を閉じる直前とアンマウントで呼ぶ */
  flush: () => void;
  /** ノートに追加できたので下書きを片付ける。失敗時には呼ばないこと */
  clear: () => void;
}

const AUTOSAVE_DELAY_MS = 500;

export function useQuickMemo(draftKey: string): UseQuickMemo {
  const [text, setTextState] = useState(() => readQuickMemoDraft(draftKey));
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const saveTimer = useRef<number | null>(null);
  // タイマー発火前に閉じられても書けるよう、最新の値と宛先を持っておく
  const pending = useRef<{ key: string; text: string } | null>(null);

  const flush = useCallback(() => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    writeQuickMemoDraft(p.key, p.text);
    setStatus('saved');
  }, []);

  // 宛先が変わったら、前の宛先の保留分を書き切ってから読み直す
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    flushRef.current();
    setTextState(readQuickMemoDraft(draftKey));
    setStatus('idle');
  }, [draftKey]);

  // アンマウント時の取りこぼしを防ぐ。localStorage は同期なのでここで間に合う
  useEffect(() => () => flushRef.current(), []);

  const setText = useCallback(
    (next: string) => {
      setTextState(next);
      pending.current = { key: draftKey, text: next };
      setStatus('saving');
      if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        saveTimer.current = null;
        const p = pending.current;
        if (!p) return;
        pending.current = null;
        writeQuickMemoDraft(p.key, p.text);
        setStatus('saved');
      }, AUTOSAVE_DELAY_MS);
    },
    [draftKey]
  );

  const clear = useCallback(() => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    pending.current = null;
    clearQuickMemoDraft(draftKey);
    setTextState('');
    setStatus('idle');
  }, [draftKey]);

  return { text, setText, status, flush, clear };
}

export default useQuickMemo;
