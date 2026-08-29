import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ActiveStudySession, StudyFinishDraft } from '../types/studyActivity';

export type { ActiveStudySession } from '../types/studyActivity';

interface StudyTimerState {
  session: ActiveStudySession | null;
  /** 「終了」を押すと計測を止めてここに入り、記録するまで残る(リロードしても消えない) */
  finishDraft: StudyFinishDraft | null;

  startSession: (
    session: Omit<ActiveStudySession, 'startedAt' | 'pausedAt' | 'pausedCount' | 'pausedTotalMs' | 'targetReachedAt'>
  ) => void;
  clearSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  markTargetReached: () => void;
  setFinishDraft: (draft: StudyFinishDraft | null) => void;
  /** サーバーに進行中セッションが存在した場合、localStorageの状態をそれで置き換える(端末・タブ跨ぎの復元) */
  restoreFromServer: (session: ActiveStudySession) => void;
}

// タイマーはページ遷移してもフローティングウィジェット的に継続させたいため、
// グローバルストア＋localStorage永続化で保持する。一時停止は startedAt を後ろにずらすことで、
// 経過時間(now - startedAt)の計算をそのまま使えるようにする(dev/miyabeのstudyTimerStoreと同方式)。
export const useStudyTimerStore = create<StudyTimerState>()(
  persist(
    (set, get) => ({
      session: null,
      finishDraft: null,

      startSession: (session) =>
        set({
          session: {
            ...session,
            startedAt: Date.now(),
            pausedAt: null,
            pausedCount: 0,
            pausedTotalMs: 0,
            targetReachedAt: null,
          },
          finishDraft: null,
        }),

      clearSession: () => set({ session: null }),

      pauseSession: () => {
        const { session } = get();
        if (!session || session.pausedAt !== null) return;
        set({ session: { ...session, pausedAt: Date.now(), pausedCount: session.pausedCount + 1 } });
      },

      resumeSession: () => {
        const { session } = get();
        if (!session || session.pausedAt === null) return;
        const pausedDuration = Date.now() - session.pausedAt;
        set({
          session: {
            ...session,
            startedAt: session.startedAt + pausedDuration,
            pausedAt: null,
            pausedTotalMs: session.pausedTotalMs + pausedDuration,
          },
        });
      },

      markTargetReached: () => {
        const { session } = get();
        if (!session || session.targetReachedAt !== null) return;
        set({ session: { ...session, targetReachedAt: Date.now() } });
      },

      setFinishDraft: (finishDraft) => set({ finishDraft }),

      restoreFromServer: (session) => set({ session, finishDraft: null }),
    }),
    {
      name: 'webcoach-study-timer',
      version: 1,
      partialize: (s) => ({ session: s.session, finishDraft: s.finishDraft }) as StudyTimerState,
    }
  )
);
