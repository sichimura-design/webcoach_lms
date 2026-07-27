import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ProgressionState {
  totalExp: number;
  awardedEventIds: Record<string, true>;
  lastStreakDaysSeen: number;
  awardExp: (eventId: string, amount: number) => void;
  noteStreakDays: (days: number, bonus: number) => number; // 新たに増えた分だけ加算し、実際に加算したexpを返す
}

// レベル/EXPはこのアプリ全体でモック運用のため、zustand + persist（studyTimerStore.tsと同じ作法）で
// localStorageに保持する。eventIdで二重加算を防ぐ。
export const useProgressionStore = create<ProgressionState>()(
  persist(
    (set, get) => ({
      totalExp: 0,
      awardedEventIds: {},
      lastStreakDaysSeen: 0,
      awardExp: (eventId, amount) => {
        if (get().awardedEventIds[eventId]) return;
        set((s) => ({
          totalExp: s.totalExp + amount,
          awardedEventIds: { ...s.awardedEventIds, [eventId]: true },
        }));
      },
      noteStreakDays: (days, bonus) => {
        const { lastStreakDaysSeen } = get();
        if (days <= lastStreakDaysSeen) return 0;
        set((s) => ({ lastStreakDaysSeen: days, totalExp: s.totalExp + bonus }));
        return bonus;
      },
    }),
    { name: 'webcoach-progression' }
  )
);
