import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 「追加先ノート」。
 *
 * ノートが器になったので、教材からクリップしたりAI回答を保存したりするとき
 * 「どのノートに入るのか」を決める必要が出た。毎回選ばせると、
 * 気づいたことを書き留めるだけの操作が3手に増えてしまう。
 *
 * レッスンごとに1度だけ選んでもらい、以後はそれを覚える。
 * 解決順: そのレッスンの追加先 → 直近に使ったノート → 無し（選ばせる）。
 *
 * 端末ごとの好みなのでサーバへ送る意味がなく、localStorage に置く
 * （store/studyTimerStore.ts と同じ流儀）。
 */
interface NoteTargetState {
  /** レッスンID → ノートID */
  byLesson: Record<string, string>;
  /** レッスンに紐づかない保存（AIコーチ専用ページなど）の受け皿 */
  lastNoteId: string | null;
  setTarget: (lessonId: number | null, noteId: string) => void;
  /** 削除済みノートを指していたときに掃除する */
  forget: (noteId: string) => void;
  resolve: (lessonId: number | null) => string | null;
}

export const useNoteTargetStore = create<NoteTargetState>()(
  persist(
    (set, get) => ({
      byLesson: {},
      lastNoteId: null,

      setTarget: (lessonId, noteId) =>
        set((s) => ({
          lastNoteId: noteId,
          byLesson:
            lessonId == null ? s.byLesson : { ...s.byLesson, [String(lessonId)]: noteId },
        })),

      forget: (noteId) =>
        set((s) => ({
          lastNoteId: s.lastNoteId === noteId ? null : s.lastNoteId,
          byLesson: Object.fromEntries(
            Object.entries(s.byLesson).filter(([, id]) => id !== noteId)
          ),
        })),

      resolve: (lessonId) => {
        const s = get();
        if (lessonId != null) {
          const hit = s.byLesson[String(lessonId)];
          if (hit) return hit;
        }
        return s.lastNoteId;
      },
    }),
    { name: 'webcoach-note-target' }
  )
);

export default useNoteTargetStore;
