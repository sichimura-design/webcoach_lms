import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import bffClient from '../services/bffClient';
import { useNoteTargetStore } from '../store/noteTargetStore';
import { NoteBlockInput, NoteSourceRef } from '../types/notes';

/**
 * 教材・AIコーチからノートへ取り込む共通の入口。
 *
 * 🔴 保存先は毎回ピッカーで選ばせる。
 *    以前はここが noteTargetStore の記憶から追加先を決めて無言で書き込んでいた。
 *    ピッカーが出る条件が「記憶が無いとき」だけだったので、一度選ぶと二度と
 *    聞かれず、しかも記憶がレッスンを越えるため、別レッスン・別コース・
 *    AIコーチからの保存まで最初に選んだ1つのノートへ吸い込まれていた。
 *    記憶は捨てず、ピッカーの先頭に置く候補（1タップで済ませるため）に使う。
 *
 * 流れ:
 *   capture()            … pending を立てる。呼び出し側がピッカーを出す
 *   resolvePending*()    … 選ばれた／作られたノートへ書き込む
 *   onSaved              … 成功したときだけ呼ばれる（下書きのクリアなど）
 */
export interface PendingCapture {
  block: NoteBlockInput;
  /** ピッカーの「〜のノートを作る」に出す既定タイトル */
  suggestedTitle: string;
  /** 新規作成するときにノートへ持たせる出どころ */
  source: NoteSourceRef | null;
  lessonId: number | null;
  /**
   * トーストの「ノートを見る」で移った先に描く戻り先。
   * 省略すると「保存した瞬間のURL」に戻る。開いていたパネルまで復元したい
   * 呼び出し元（教材ページ）は、自分で組んで渡す。
   */
  backTo?: BackTo;
  /**
   * 追加が成功したときだけ呼ばれる。
   * 🔴 やめた／失敗したときは呼ばれない。下書きの内容を失わせないため、
   *    クリアはここでしか行わない（capture() の直後には消さない）。
   */
  onSaved?: (noteId: string) => void;
}

/** ノートから元の画面へ戻るための行き先。/notes のノート面が描く */
export interface BackTo {
  to: string;
  label: string;
}

/** ピッカーに出す「何を保存しようとしているか」の1行 */
export function previewOf(block: NoteBlockInput): string {
  if (block.kind === 'answer') return block.question || block.answer;
  // 画像は取り込み経路（教材のクリップ／AI回答）から来ないが、型としては通る
  if (block.kind === 'image') return block.caption ?? '画像';
  return block.text;
}

export function useNoteCapture() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  // 🔴 suggestFor はここでは読まない。読んで保存先を決めた瞬間に、
  //    「一度選んだら以後は聞かない」という元の不具合に戻る。
  //    先頭候補として使うのは NoteTargetPicker の役目。
  const remember = useNoteTargetStore((s) => s.remember);
  const forget = useNoteTargetStore((s) => s.forget);

  const [pending, setPending] = useState<PendingCapture | null>(null);
  /** 書き込み中。ピッカーが毎回出るので、行の2度押しで同じブロックが2つ入るのを防ぐ */
  const [saving, setSaving] = useState(false);

  /** ノートを開く。戻り先を渡すと、向こう側に「〜に戻る」を描ける */
  const openNotes = useCallback(
    (noteId?: string, backTo?: BackTo) => {
      const url = noteId ? `/notes?note=${encodeURIComponent(noteId)}` : '/notes';
      navigate(url, backTo ? { state: { backTo } } : undefined);
    },
    [navigate]
  );

  /**
   * 戻り先は「保存した瞬間に見ていた画面」。
   * ノート自身の source は"そのノートが生まれたレッスン"なので使えない
   * （第5レッスンのクリップを第1レッスン由来のノートに入れると、
   *   ラベルも行き先も第1レッスンになってしまう）。
   */
  const backToOf = useCallback(
    (source: NoteSourceRef | null): BackTo => ({
      to: `${location.pathname}${location.search}`,
      label: source ? `「${source.lessonTitle}」に戻る` : '元の画面に戻る',
    }),
    [location.pathname, location.search]
  );

  /** 実際に書き込む。ノートが消えていたら記憶を捨てる。成功したら noteId を返す */
  const append = useCallback(
    async (noteId: string, input: PendingCapture): Promise<string | null> => {
      try {
        await bffClient.appendNoteBlock(noteId, input.block);
        const note = await bffClient.getNote(noteId);
        remember(input.lessonId, { noteId, title: note.title });
        const backTo = input.backTo ?? backToOf(input.source);
        // 🔴 ここで遷移しない。保存しても教材のページはそのままにして、
        //    見たい人だけがトーストから移動する。
        showToast(`「${note.title}」に追加しました`, 'success', {
          action: { label: 'ノートを見る', onClick: () => openNotes(noteId, backTo) },
        });
        return noteId;
      } catch {
        forget(noteId);
        showToast('ノートに追加できませんでした', 'error');
        return null;
      }
    },
    [remember, forget, showToast, openNotes, backToOf]
  );

  /** 取り込む。追加先は決めず、必ずピッカーに出す */
  const capture = useCallback((input: PendingCapture) => {
    setPending(input);
  }, []);

  /** ピッカーで既存ノートが選ばれた */
  const resolvePendingWithNote = useCallback(
    async (noteId: string): Promise<string | null> => {
      if (!pending || saving) return null;
      setSaving(true);
      try {
        const savedId = await append(noteId, pending);
        if (savedId) {
          pending.onSaved?.(savedId);
          setPending(null);
        }
        return savedId;
      } finally {
        setSaving(false);
      }
    },
    [pending, saving, append]
  );

  /** ピッカーで「新しく作る」が選ばれた */
  const resolvePendingWithNewNote = useCallback(async (): Promise<string | null> => {
    if (!pending || saving) return null;
    setSaving(true);
    try {
      const note = await bffClient.createNote({
        title: pending.suggestedTitle,
        source: pending.source,
        // 出どころは取り込むものの種類で決まる。AI回答から生まれたノートは
        // レッスンの文脈を持っていても「AIコーチ」として扱う
        origin:
          pending.block.kind === 'answer' ? 'ai' : pending.source ? 'material' : 'self',
      });
      const savedId = await append(note.id, pending);
      if (savedId) {
        pending.onSaved?.(savedId);
        setPending(null);
      }
      return savedId;
    } catch {
      showToast('ノートを作成できませんでした', 'error');
      return null;
    } finally {
      setSaving(false);
    }
  }, [pending, saving, append, showToast]);

  const cancelPending = useCallback(() => setPending(null), []);

  return {
    capture,
    pending,
    saving,
    resolvePendingWithNote,
    resolvePendingWithNewNote,
    cancelPending,
    openNotes,
  };
}

export default useNoteCapture;
