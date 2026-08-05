import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 最近開いた教材。集中ブースの「教材を選ぶ」の選択肢に使う。
 *
 * 「前回の続き」は実BFFの /webcoach/resumecourse が持っているが、そちらは
 * レッスンを完了したときにしか更新されない（hooks/useLessonCompletion.ts）。
 * 「開いただけの教材」を覚えている場所が無かったので、端末ごとの履歴として持つ。
 * サーバに送る意味がないUI寄りの情報なので zustand + persist
 * （progressionStore.ts / studyTimerStore.ts と同じ作法）。
 */
export interface RecentCourseEntry {
  courseId: number;
  courseTitle: string;
  lessonId?: number;
  lessonTitle?: string;
  progressPercent?: number;
  /** epoch ms */
  openedAt: number;
}

const MAX_ENTRIES = 10;

interface RecentCourseState {
  entries: RecentCourseEntry[];
  /** 教材を開いたときに呼ぶ。同じコースは最新の1件にまとめる */
  touch: (entry: Omit<RecentCourseEntry, 'openedAt'>) => void;
  clear: () => void;
}

export const useRecentCourseStore = create<RecentCourseState>()(
  persist(
    (set, get) => ({
      entries: [],
      touch: (entry) => {
        if (!entry.courseId) return;
        const prev = get().entries;
        const same = prev.find((e) => e.courseId === entry.courseId);
        // 同じコースの同じレッスンを開き直しただけなら書き込まない
        // （レンダーごとに localStorage を叩かないため）
        if (same && same.lessonId === entry.lessonId && Date.now() - same.openedAt < 60_000) return;
        const next: RecentCourseEntry = { ...entry, openedAt: Date.now() };
        set({
          entries: [next, ...prev.filter((e) => e.courseId !== entry.courseId)].slice(
            0,
            MAX_ENTRIES
          ),
        });
      },
      clear: () => set({ entries: [] }),
    }),
    { name: 'webcoach-recent-courses' }
  )
);
