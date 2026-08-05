import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ActiveStudySession, StudyFinishDraft } from '../types/studyActivity';
import { newActivityId } from '../utils/studyStats';

// 実行中セッションの型は types/studyActivity.ts にある（utils/studyStats.ts が参照するため。
// ここに置くと store → utils → store の循環 import になる）。既存の import を壊さないよう再export する。
export type { ActiveStudySession } from '../types/studyActivity';

interface StudyTimerState {
  session: ActiveStudySession | null;
  /**
   * 終了カードの下書き。「終了」を押すと計測を止めてここに入り、記録するまで残る。
   * カードを開いたままリロードしても消えないよう永続化する。
   */
  finishDraft: StudyFinishDraft | null;
  /**
   * 記録が保存されるたびに増える。統計・履歴の再取得トリガ。
   * 永続化しない（タブ内の合図なので、リロードで復元する意味がない）。
   */
  activityRevision: number;

  startSession: (
    session: Omit<
      ActiveStudySession,
      'startedAt' | 'pausedAt' | 'pausedCount' | 'pausedTotalMs' | 'activityId' | 'targetReachedAt'
    >
  ) => void;
  clearSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  /** ポモドーロが設定時間に到達した。多重通知を防ぐため時刻を記録する */
  markTargetReached: () => void;
  /** 稼働中でも学習目標を書き足せる */
  updateGoal: (goalText: string) => void;

  setFinishDraft: (draft: StudyFinishDraft | null) => void;
  patchFinishDraft: (patch: Partial<StudyFinishDraft>) => void;
  bumpActivityRevision: () => void;
}

// タイマーはページ遷移してもフローティングウィジェット／教材ページのミニタイマーとして
// 常駐させたいため、グローバルストア＋localStorage永続化（リロードしても継続扱い）で保持する。
// 一時停止は startedAt を後ろにずらすことで、経過時間(now - startedAt)の計算をそのまま使えるようにする。
// ずらしで失われる一時停止の合計は pausedTotalMs に別途足していく（記録に残すため）。
export const useStudyTimerStore = create<StudyTimerState>()(
  persist(
    (set, get) => ({
      session: null,
      finishDraft: null,
      activityRevision: 0,

      startSession: (session) =>
        set({
          session: {
            ...session,
            startedAt: Date.now(),
            pausedAt: null,
            pausedCount: 0,
            pausedTotalMs: 0,
            // 開始時に確定させる。POSTが失敗しても・再送しても EXP の eventId が変わらない
            activityId: newActivityId(Date.now()),
            targetReachedAt: null,
          },
          finishDraft: null,
        }),

      clearSession: () => set({ session: null }),

      pauseSession: () => {
        const { session } = get();
        if (!session || session.pausedAt !== null) return;
        set({
          session: { ...session, pausedAt: Date.now(), pausedCount: session.pausedCount + 1 },
        });
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
            // 目標に到達したあと再開したなら、超過分を続けて計測する
            targetReachedAt: session.targetReachedAt,
          },
        });
      },

      markTargetReached: () => {
        const { session } = get();
        if (!session || session.targetReachedAt !== null) return;
        set({ session: { ...session, targetReachedAt: Date.now() } });
      },

      updateGoal: (goalText) => {
        const { session } = get();
        if (!session) return;
        set({ session: { ...session, goalText } });
      },

      setFinishDraft: (finishDraft) => set({ finishDraft }),

      patchFinishDraft: (patch) => {
        const { finishDraft } = get();
        if (!finishDraft) return;
        set({ finishDraft: { ...finishDraft, ...patch } });
      },

      bumpActivityRevision: () => set((s) => ({ activityRevision: s.activityRevision + 1 })),
    }),
    {
      name: 'webcoach-study-timer',
      version: 2,
      // v1 の session には activityId / pausedCount / pausedTotalMs が無い。
      // 補完しないと id 無しでPOSTしてしまうため、ここで必ず埋める。
      migrate: (state: unknown, from: number) => {
        if (from >= 2) return state as StudyTimerState;
        const old = state as { session?: Partial<ActiveStudySession> } | null;
        const oldSession = old?.session;
        return {
          ...(state as object),
          finishDraft: null,
          activityRevision: 0,
          session: oldSession?.startedAt
            ? {
                ...oldSession,
                pausedCount: 0,
                pausedTotalMs: 0,
                activityId: newActivityId(oldSession.startedAt),
                targetReachedAt: null,
              }
            : null,
        } as StudyTimerState;
      },
      // 再取得トリガは永続化しない
      partialize: (s) => ({ session: s.session, finishDraft: s.finishDraft }) as StudyTimerState,
    }
  )
);
