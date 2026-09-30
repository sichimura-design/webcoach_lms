import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 最近開いた教材。
 *
 * いまの主な用途は、学習記録の打診ポップ（components/shared/StudySessionHost.tsx）が
 * 「いま開いている教材の名前」を知るため。レッスンを開くたびに useLessonDoc が
 * touch していて、courseId から名前・レッスン名・進捗を引ける唯一の場所になっている。
 * ここを見れば済むので、記録を始めるためにAPIを叩き直す必要がない。
 *
 * 「前回の続き」は実BFFの /webcoach/resumecourse も持っているが、そちらは
 * ユーザーごとに1行・コース単位（どのレッスンかを持たない）。
 * 「開いたレッスン」を覚えている場所が無かったので、端末ごとの履歴として持つ。
 * サーバに送る意味がないUI寄りの情報なので zustand + persist
 * （progressionStore.ts / studyTimerStore.ts と同じ作法）。
 *
 * 🔴 localStorage は端末（ブラウザ）単位で、ユーザーの区別が無い。同じブラウザで別の
 *    ユーザーがログインすると、前のユーザーが開いたコース・レッスンがマイページ
 *    「続きから学習」の候補や集中ブースのレッスン候補に混ざっていた。
 *    履歴の持ち主（ownerId）を覚えておき、ログインしたユーザーが違えば捨てる（bindUser）。
 *    bindUser はログイン処理（AuthContext）で user を立てる直前に呼ぶので、
 *    画面が前のユーザーの履歴を読む瞬間は無い。読む側は entries をそのまま使ってよい。
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
  /** entries の持ち主の Moodle ユーザーID。この修正より前に保存された履歴は null（持ち主不明） */
  ownerId: number | null;
  entries: RecentCourseEntry[];
  /** ログインしたユーザーを伝える。持ち主と違えば（持ち主不明も含め）履歴を捨てる */
  bindUser: (userId: number) => void;
  /** 教材を開いたときに呼ぶ。同じコースは最新の1件にまとめる */
  touch: (entry: Omit<RecentCourseEntry, 'openedAt'>) => void;
  clear: () => void;
}

export const useRecentCourseStore = create<RecentCourseState>()(
  persist(
    (set, get) => ({
      ownerId: null,
      entries: [],
      bindUser: (userId) => {
        if (!userId || get().ownerId === userId) return;
        set({ ownerId: userId, entries: [] });
      },
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
