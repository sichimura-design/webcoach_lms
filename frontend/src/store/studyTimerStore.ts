import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StudySessionMode } from '../types/studyRoom';

export interface ActiveStudySession {
  mode: StudySessionMode;
  targetMinutes?: number;
  courseId?: number;
  courseTitle?: string;
  startedAt: number; // epoch ms。タブを閉じてもここから経過時間を再計算できるようにする
  pausedAt: number | null; // 一時停止した時刻。nullなら稼働中
}

interface StudyTimerState {
  session: ActiveStudySession | null;
  startSession: (session: Omit<ActiveStudySession, 'startedAt' | 'pausedAt'>) => void;
  clearSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
}

// タイマーはページ遷移してもフローティングウィジェットとして常駐させたいため、
// グローバルストア＋localStorage永続化（リロードしても継続扱いにする）で保持する。
// 一時停止は startedAt を後ろにずらすことで、経過時間(now - startedAt)の計算をそのまま使えるようにする。
export const useStudyTimerStore = create<StudyTimerState>()(
  persist(
    (set, get) => ({
      session: null,
      startSession: (session) => set({ session: { ...session, startedAt: Date.now(), pausedAt: null } }),
      clearSession: () => set({ session: null }),
      pauseSession: () => {
        const { session } = get();
        if (!session || session.pausedAt !== null) return;
        set({ session: { ...session, pausedAt: Date.now() } });
      },
      resumeSession: () => {
        const { session } = get();
        if (!session || session.pausedAt === null) return;
        const pausedDuration = Date.now() - session.pausedAt;
        set({ session: { ...session, startedAt: session.startedAt + pausedDuration, pausedAt: null } });
      },
    }),
    { name: 'webcoach-study-timer' }
  )
);
