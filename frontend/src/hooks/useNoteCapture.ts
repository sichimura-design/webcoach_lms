import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import bffClient from '../services/bffClient';
import { useNoteTargetStore } from '../store/noteTargetStore';
import { NoteBlockInput, NoteSourceRef } from '../types/notes';

/**
 * 教材・AIコーチからノートへ取り込む共通の入口。
 *
 * 以前は呼び出し側が3箇所それぞれで NoteCreateInput を組み立てていた。
 * ノートが器になった今は「どのノートに入れるか」の判断が加わるので、
 * その分岐を1箇所に集める。
 *
 * 流れ:
 *   追加先が決まっている → そのまま入れてトーストで知らせる
 *   決まっていない       → pending に積んで、呼び出し側がピッカーを出す
 *                          選ばれたら resolvePending() で流し込む
 */
export interface PendingCapture {
  block: NoteBlockInput;
  /** ピッカーの「〜のノートを作る」に出す既定タイトル */
  suggestedTitle: string;
  /** 新規作成するときにノートへ持たせる出どころ */
  source: NoteSourceRef | null;
  lessonId: number | null;
}

export function useNoteCapture() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const resolveTarget = useNoteTargetStore((s) => s.resolve);
  const setTarget = useNoteTargetStore((s) => s.setTarget);
  const forget = useNoteTargetStore((s) => s.forget);

  const [pending, setPending] = useState<PendingCapture | null>(null);

  /** 実際に書き込む。ノートが消えていたら追加先を忘れて選び直させる */
  const append = useCallback(
    async (noteId: string, block: NoteBlockInput, lessonId: number | null): Promise<boolean> => {
      try {
        await bffClient.appendNoteBlock(noteId, block);
        const note = await bffClient.getNote(noteId);
        setTarget(lessonId, noteId);
        showToast(`「${note.title}」に追加しました`, 'success');
        return true;
      } catch {
        forget(noteId);
        showToast('ノートに追加できませんでした', 'error');
        return false;
      }
    },
    [setTarget, forget, showToast]
  );

  /**
   * 取り込む。追加先が決まっていなければ pending を立てて false を返す
   * （呼び出し側は pending を見てピッカーを出す）。
   */
  const capture = useCallback(
    async (input: PendingCapture): Promise<boolean> => {
      const target = resolveTarget(input.lessonId);
      if (!target) {
        setPending(input);
        return false;
      }
      return append(target, input.block, input.lessonId);
    },
    [resolveTarget, append]
  );

  /** ピッカーで既存ノートが選ばれた */
  const resolvePendingWithNote = useCallback(
    async (noteId: string) => {
      if (!pending) return;
      const ok = await append(noteId, pending.block, pending.lessonId);
      if (ok) setPending(null);
    },
    [pending, append]
  );

  /** ピッカーで「新しく作る」が選ばれた */
  const resolvePendingWithNewNote = useCallback(async () => {
    if (!pending) return;
    try {
      const note = await bffClient.createNote({
        title: pending.suggestedTitle,
        source: pending.source,
        // 出どころは取り込むものの種類で決まる。AI回答から生まれたノートは
        // レッスンの文脈を持っていても「AIコーチ」として扱う
        origin:
          pending.block.kind === 'answer' ? 'ai' : pending.source ? 'material' : 'self',
      });
      const ok = await append(note.id, pending.block, pending.lessonId);
      if (ok) setPending(null);
    } catch {
      showToast('ノートを作成できませんでした', 'error');
    }
  }, [pending, append, showToast]);

  const cancelPending = useCallback(() => setPending(null), []);

  const openNotes = useCallback((noteId?: string) => {
    navigate(noteId ? `/notes?note=${encodeURIComponent(noteId)}` : '/notes');
  }, [navigate]);

  return {
    capture,
    pending,
    resolvePendingWithNote,
    resolvePendingWithNewNote,
    cancelPending,
    openNotes,
  };
}

export default useNoteCapture;
