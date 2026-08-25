import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ActiveStudySession, StudyCategory, StudyFinishDraft } from '../types/studyActivity';
import { newActivityId, toLocalDateKey } from '../utils/studyStats';

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
  /**
   * 最後に打診を断った日（YYYY-MM-DD）。日付が変わったら promptDeclineCount を数え直す。
   * 🔴 日付で持つので翌日には自然に戻る（永久にオフにはしない）。
   */
  promptDeclinedOn: string | null;
  /**
   * promptDeclinedOn の日に断った回数。
   * 🔴 断るのは「そのページの見送り」で、同じ日に一定回数（打診側の
   *    PROMPT_DECLINE_LIMIT）に達したらその日はもう打診しない、という段階的な作り。
   *    以前は1回断ったらその日ずっと打診を止めていたが、気が変わったときの
   *    復帰手段が常設ピル（＝2つ目の開始入口）しか無くなるのが問題だった。
   *    ピルを撤去して、代わりに断り方をここで段階化している。
   */
  promptDeclineCount: number;

  startSession: (
    session: Omit<
      ActiveStudySession,
      | 'startedAt'
      | 'pausedAt'
      | 'pausedCount'
      | 'pausedTotalMs'
      | 'activityId'
      | 'targetReachedAt'
      | 'segments'
      | 'lastActiveAt'
    > & { category: StudyCategory }
  ) => void;
  clearSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  /** ポモドーロが設定時間に到達した。多重通知を防ぐため時刻を記録する */
  markTargetReached: () => void;
  /** 稼働中でも学習目標を書き足せる */
  updateGoal: (goalText: string) => void;

  /** 開いている区間を閉じて、別カテゴリの区間を開く。同じカテゴリなら何もしない */
  switchCategory: (category: StudyCategory) => void;
  /** ユーザーの操作を観測した。放置検知の基準時刻を進める */
  markActive: () => void;
  /** 放置ぶんを切り捨てて一時停止する。開いている区間も lastActiveAt で閉じる */
  trimToLastActive: () => void;

  /** 打診を断った。同じ日のうちは回数が積み上がる */
  declinePrompt: () => void;

  setFinishDraft: (draft: StudyFinishDraft | null) => void;
  patchFinishDraft: (patch: Partial<StudyFinishDraft>) => void;
  bumpActivityRevision: () => void;
}

/** 開いている区間（最後の要素で endedAt === null）の startedAt を後ろにずらす */
function shiftOpenSegment(segments: ActiveStudySession['segments'], ms: number): ActiveStudySession['segments'] {
  const open = segments[segments.length - 1];
  if (!open || open.endedAt !== null) return segments;
  return [...segments.slice(0, -1), { ...open, startedAt: open.startedAt + ms }];
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
      promptDeclinedOn: null,
      promptDeclineCount: 0,

      startSession: ({ category, ...session }) => {
        const now = Date.now();
        set({
          session: {
            ...session,
            startedAt: now,
            pausedAt: null,
            pausedCount: 0,
            pausedTotalMs: 0,
            // 開始時に確定させる。POSTが失敗しても・再送しても EXP の eventId が変わらない
            activityId: newActivityId(now),
            targetReachedAt: null,
            segments: [{ category, startedAt: now, endedAt: null }],
            lastActiveAt: now,
          },
          finishDraft: null,
        });
      },

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
            // 🔴 開いている区間も同じ量ずらす。ここを忘れると区間の合計と
            //    sessionElapsedSeconds が食い違い、内訳の和が学習時間と合わなくなる。
            segments: shiftOpenSegment(session.segments, pausedDuration),
            pausedAt: null,
            pausedTotalMs: session.pausedTotalMs + pausedDuration,
            lastActiveAt: Date.now(),
            // 目標に到達したあと再開したなら、超過分を続けて計測する
            targetReachedAt: session.targetReachedAt,
          },
        });
      },

      switchCategory: (category) => {
        const { session } = get();
        if (!session) return;
        // 一時停止中は「いま計測していない」ので切り替えない。
        // 停止中に画面を見て回っただけで区間が増えると、内訳が細切れになる。
        if (session.pausedAt !== null) return;
        const open = session.segments[session.segments.length - 1];
        if (open && open.endedAt === null && open.category === category) return;
        const now = Date.now();
        set({
          session: {
            ...session,
            segments: [
              ...session.segments.slice(0, -1),
              ...(open ? [{ ...open, endedAt: open.endedAt ?? now }] : []),
              { category, startedAt: now, endedAt: null },
            ],
            // 🔴 lastActiveAt はここでは触らない。markActive だけが書き手。
            //    区間の切り替えはリロード直後にも起きるので、ここで今に更新すると
            //    「数時間放置してから開き直した」証拠が消えて放置検知が効かなくなる。
          },
        });
      },

      markActive: () => {
        const { session } = get();
        if (!session || session.pausedAt !== null) return;
        set({ session: { ...session, lastActiveAt: Date.now() } });
      },

      trimToLastActive: () => {
        const { session } = get();
        if (!session || session.pausedAt !== null) return;
        /*
         * 放置ぶんを計測から落とす。
         * 🔴 pausedAt に「最後に操作した時刻」を入れるだけでよい。経過時間も区間の長さも
         *    end = pausedAt ?? now で測る決まりなので、開いている区間もここで自動的に止まる。
         *    区間を閉じてしまうと、再開したときに開いている区間が無くなってしまう。
         */
        set({
          session: {
            ...session,
            pausedAt: Math.max(session.lastActiveAt, session.startedAt),
            pausedCount: session.pausedCount + 1,
          },
        });
      },

      declinePrompt: () => {
        const today = toLocalDateKey(new Date());
        const s = get();
        // 日付が変わっていたら数え直す（前日ぶんを引き継がない）
        const count = s.promptDeclinedOn === today ? s.promptDeclineCount + 1 : 1;
        set({ promptDeclinedOn: today, promptDeclineCount: count });
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
      version: 3,
      /*
       * v1: activityId / pausedCount / pausedTotalMs が無い。補完しないと id 無しでPOSTする。
       * v2: segments / lastActiveAt が無い。区間が空だと内訳の合計が学習時間と合わなくなるので、
       *     セッション全体を1本の 'material' 区間として作り直す（旧実装で開始できたのは
       *     集中ブースと教材ページだけなので、教材として扱うのが実態に一番近い）。
       */
      migrate: (state: unknown, from: number) => {
        const base = state as (Partial<StudyTimerState> & { session?: Partial<ActiveStudySession> }) | null;
        let session = base?.session ?? null;

        if (from < 2 && session?.startedAt) {
          session = {
            ...session,
            pausedCount: 0,
            pausedTotalMs: 0,
            activityId: newActivityId(session.startedAt),
            targetReachedAt: null,
          };
        }
        if (from < 3 && session?.startedAt) {
          session = {
            ...session,
            segments: [{ category: 'material' as const, startedAt: session.startedAt, endedAt: null }],
            lastActiveAt: Date.now(),
          };
        }

        return {
          ...(state as object),
          finishDraft: from < 2 ? null : (base?.finishDraft ?? null),
          activityRevision: 0,
          promptDeclinedOn: base?.promptDeclinedOn ?? null,
          promptDeclineCount: base?.promptDeclineCount ?? 0,
          session: session?.startedAt ? session : null,
        } as StudyTimerState;
      },
      // 再取得トリガは永続化しない
      partialize: (s) =>
        ({
          session: s.session,
          finishDraft: s.finishDraft,
          promptDeclinedOn: s.promptDeclinedOn,
          promptDeclineCount: s.promptDeclineCount,
        }) as StudyTimerState,
    }
  )
);
