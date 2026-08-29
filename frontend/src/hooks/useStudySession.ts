import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useStudyTimerStore } from '../store/studyTimerStore';
import { useProgressionStore } from '../store/progressionStore';
import { bffClient } from '../services/bffClient';
import { StudySessionMode } from '../types/studyRoom';
import {
  ActiveStudySession,
  StudyActivity,
  StudyCategory,
  StudyFinishDraft,
  StudySegmentTotal,
} from '../types/studyActivity';
import { EXP_RULES } from '../utils/progression';
import {
  MIN_RECORDABLE_SECONDS,
  buildActivityInput,
  buildFinishDraft,
  dialRatio,
  hasReachedTarget,
  isIdleSession,
  isStaleSession,
  sessionRemainingSeconds,
  sessionSegmentTotals,
} from '../utils/studyStats';
import { useElapsedSeconds } from './useElapsedSeconds';

/**
 * dev/kanegae統合メモ:
 *   本体（区間・カテゴリ・放置検知・EXP等）は dev/miyabe 由来。区間別の内訳や
 *   目標テキスト・達成度は永続化する実バックエンドが無いため、あくまで
 *   「このタブの中だけの下書き・演出」として扱う（リロードすると localStorage の
 *   範囲でしか残らない）。
 *   一方、実際の学習時間の記録（開始・終了・分の修正）は dev/kanegae の実API
 *   （bffClient.startStudySession / endStudySession / correctStudySession /
 *   getActiveStudySession）にそのまま接続している。これは Moodle のログ
 *   (mdl_logstore_standard_log) に実際に書き込まれる、唯一の永続化経路。
 *   TODO(backend未実装): カテゴリ別内訳・目標・達成度・StudyActivityそのものを
 *     保存する実テーブルは無い。commitFinish はサーバーに1件POSTするのではなく、
 *     ローカルで組み立てた StudyActivity を返す「終了画面用のレシート」に留める。
 */

export interface StartParams {
  /** ポモドーロの設定時間。通常タイマーでも「目安」として保持する（捨てない） */
  targetMinutes?: number;
  courseId?: number;
  courseTitle?: string;
  lessonId?: number;
  lessonTitle?: string;
  progressPercentAtStart?: number;
  goalText?: string;
  /** 最初の区間のカテゴリ。開始時に見ていたページから決まる（ユーザーに選ばせない） */
  category: StudyCategory;
  mode: StudySessionMode;
}

/**
 * 記録を破棄する際、直前に閉じたMoodleログ上のセグメントを実質ゼロ分に補正するための
 * 十分大きな負の補正値。GREATEST(0, 実測分 + delta)で必ず0にクランプされる
 * (1回のセグメントがこれを上回る分数になることは無い)。
 */
const DISCARD_DELTA_MINUTES = -100000;

export interface UseStudySession {
  session: ActiveStudySession | null;
  elapsedSeconds: number;
  /** ポモドーロのみ。通常タイマーは残り時間の概念が無いので null */
  remainingSeconds: number | null;
  /** 円形ダイヤルの塗り割合（0..1） */
  ratio: number;
  running: boolean;
  /** ポモドーロが設定時間に到達した（自動一時停止済み） */
  reachedTarget: boolean;
  /** 一時停止のまま/動かしたまま長時間放置された（タイマーの消し忘れ） */
  stale: boolean;
  /** 最後の操作から30分動きが無い（離席の疑い）。確認ポップを出す合図 */
  idle: boolean;
  /** 実行中セッションのカテゴリ別内訳（実測秒）。合計は elapsedSeconds と一致する */
  segmentTotals: StudySegmentTotal[];

  start: (params: StartParams) => void;
  pause: () => void;
  resume: () => void;
  /** ページが変わってカテゴリが変わった。同じカテゴリなら何も起きない */
  switchCategory: (category: StudyCategory) => void;
  /** 放置ぶんを切り捨てて一時停止する */
  trimToLastActive: () => void;
  /** 記録せずに破棄して未開始に戻す */
  discard: () => void;
  updateGoal: (goalText: string) => void;

  /** 「終了」。計測を止めて下書きを作るだけ。まだ記録しない */
  prepareFinish: () => void;
  /** 下書きを捨てて計測に戻る（一時停止のまま残る） */
  cancelFinish: () => void;
  /** 「そのまま記録」「内容を追加して記録」の両方がこれを呼ぶ */
  commitFinish: (patch?: Partial<StudyFinishDraft>) => Promise<StudyActivity | null>;
  finishDraft: StudyFinishDraft | null;
}

export function useStudySession(userId: number | undefined): UseStudySession {
  const session = useStudyTimerStore((s) => s.session);
  const finishDraft = useStudyTimerStore((s) => s.finishDraft);
  const startSession = useStudyTimerStore((s) => s.startSession);
  const clearSession = useStudyTimerStore((s) => s.clearSession);
  const restoreFromServer = useStudyTimerStore((s) => s.restoreFromServer);
  const pauseSessionInStore = useStudyTimerStore((s) => s.pauseSession);
  const resumeSessionInStore = useStudyTimerStore((s) => s.resumeSession);
  const markTargetReached = useStudyTimerStore((s) => s.markTargetReached);
  const updateGoalInStore = useStudyTimerStore((s) => s.updateGoal);
  const switchCategory = useStudyTimerStore((s) => s.switchCategory);
  const trimToLastActive = useStudyTimerStore((s) => s.trimToLastActive);
  const setFinishDraft = useStudyTimerStore((s) => s.setFinishDraft);
  const bumpActivityRevision = useStudyTimerStore((s) => s.bumpActivityRevision);
  const awardExp = useProgressionStore((s) => s.awardExp);

  const elapsedSeconds = useElapsedSeconds(session);

  // 起動時: localStorageに無くても、サーバー(Moodleログ)に進行中セッションがあれば復元する。
  // タブを閉じた/別画面から戻った/localStorageが消えた場合でも、直近のstudy_session_startedに
  // 対応するendedがまだ無ければ、それを正としてタイマー状態を継続できるようにする(dev/kanegae)。
  const syncedRef = useRef(false);
  useEffect(() => {
    if (!userId || syncedRef.current) return;
    syncedRef.current = true;

    bffClient
      .getActiveStudySession(userId)
      .then((active) => {
        if (!active) {
          if (useStudyTimerStore.getState().session) clearSession();
          return;
        }
        // ローカルに既にセッションがあれば、サーバーの開始時刻とは厳密照合せずローカルを正とする
        // (DB行idが無いため一意な突合はできない。一時停止/再開のズレは許容する)
        if (useStudyTimerStore.getState().session) return;

        restoreFromServer({
          sessionId: Date.now(),
          courseId: active.courseid ?? undefined,
          courseTitle: undefined,
          startedAt: new Date(active.started_at).getTime(),
        });
      })
      .catch(() => {
        // 復元に失敗してもタイマー未開始として振る舞えばよい
      });
  }, [userId, clearSession, restoreFromServer]);

  // 一時停止のたびにstudy_session_ended、再開のたびに新しいstudy_session_startedを
  // Moodleへベストエフォートで送る(dev/kanegae。ローカルのタイマー状態は同期的に即座に更新する)。
  const pauseSession = useCallback(() => {
    const current = useStudyTimerStore.getState().session;
    pauseSessionInStore();
    if (userId) {
      bffClient.endStudySession(userId, current?.courseId).catch(() => {});
    }
  }, [userId, pauseSessionInStore]);

  const resumeSession = useCallback(() => {
    const current = useStudyTimerStore.getState().session;
    resumeSessionInStore();
    if (userId) {
      bffClient.startStudySession(userId, current?.courseId).catch(() => {});
    }
  }, [userId, resumeSessionInStore]);

  // ポモドーロ完了の検知。ref でガードして1回だけ処理する
  // （毎tickで pauseSession を呼ぶと一時停止カウントが増え続ける）
  const targetHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (!session) {
      targetHandledRef.current = null;
      return;
    }
    if (session.targetReachedAt !== null) return;
    if (targetHandledRef.current === session.activityId) return;
    if (!hasReachedTarget(session)) return;

    targetHandledRef.current = session.activityId;
    markTargetReached();
    // 🔴 ここで自動記録はしない。離席中に記録が確定すると実際の学習時間とずれる。
    //    一時停止で止めるだけにして、記録するか続けるかは受講生が決める。
    //    停止しておくことで、放置による時間の水増しも起きない。
    pauseSession();
  }, [session, elapsedSeconds, markTargetReached, pauseSession]);

  const start = useCallback(
    (params: StartParams) => {
      startSession({
        mode: params.mode,
        targetMinutes: params.targetMinutes,
        courseId: params.courseId,
        courseTitle: params.courseTitle,
        lessonId: params.lessonId,
        lessonTitle: params.lessonTitle,
        progressPercentAtStart: params.progressPercentAtStart,
        goalText: params.goalText,
        category: params.category,
      });
      if (userId) {
        bffClient.startStudySession(userId, params.courseId).catch(() => {});
      }
    },
    [userId, startSession]
  );

  /** 直前に閉じたセグメントを実質ゼロ分に補正する(discard・極端に短い記録の破棄で共用。dev/kanegae) */
  const zeroOutLastSegment = useCallback(
    (courseId: number | undefined) => {
      if (!userId) return;
      bffClient.correctStudySession(userId, DISCARD_DELTA_MINUTES, courseId).catch(() => {});
    },
    [userId]
  );

  const discard = useCallback(() => {
    const current = session;
    setFinishDraft(null);
    clearSession();
    if (!current) return;
    // 稼働中のまま破棄する場合は先にセグメントを閉じる(一時停止中なら既に閉じている)
    if (current.pausedAt === null && userId) {
      bffClient.endStudySession(userId, current.courseId).catch(() => {});
    }
    zeroOutLastSegment(current.courseId);
  }, [session, userId, clearSession, setFinishDraft, zeroOutLastSegment]);

  const prepareFinish = useCallback(() => {
    if (!session) return;
    // 🔴 先に一時停止する。カードを見ている間もカウントが進むと、
    //    確認した数字と実際に記録される数字がずれる。
    const endAt = session.pausedAt ?? Date.now();
    if (session.pausedAt === null) pauseSession();
    setFinishDraft(buildFinishDraft(session, endAt));
  }, [session, pauseSession, setFinishDraft]);

  const cancelFinish = useCallback(() => setFinishDraft(null), [setFinishDraft]);

  const commitFinish = useCallback(
    async (patch?: Partial<StudyFinishDraft>): Promise<StudyActivity | null> => {
      const base = useStudyTimerStore.getState().finishDraft;
      if (!base || !userId) {
        setFinishDraft(null);
        clearSession();
        return null;
      }
      const draft: StudyFinishDraft = { ...base, ...patch };

      // 数秒の誤操作を記録しない。1分丸めを積むと「学習した日」が誤って成立してしまう。
      const naturalMinutes = Math.max(1, Math.round(draft.measuredSeconds / 60));
      const untouched = draft.actualMinutes === naturalMinutes;
      setFinishDraft(null);
      clearSession();

      if (draft.measuredSeconds < MIN_RECORDABLE_SECONDS && untouched) {
        // ended事件は既にprepareFinish/pauseSessionで送信済みなので、実質ゼロ分に補正する(dev/kanegae)。
        zeroOutLastSegment(draft.snapshot.course?.courseId);
        bumpActivityRevision();
        return null;
      }

      // ユーザーが分数を修正していたら、その差分だけ実際の記録(Moodleログ)を補正する(dev/kanegae)。
      // 「そのまま記録」（未修正）のときは、リアルタイムのstart/endで既に正しく積まれている。
      if (!untouched) {
        const deltaMinutes = Math.max(0, draft.actualMinutes) - naturalMinutes;
        bffClient.correctStudySession(userId, deltaMinutes, draft.snapshot.course?.courseId).catch(() => {});
      }

      // 教材の進捗（要件の自動記録項目）は終了時点の値を取り直す。失敗しても記録は続行する。
      let progressPercentAtEnd: number | undefined;
      const courseId = draft.snapshot.course?.courseId;
      if (courseId) {
        progressPercentAtEnd = await bffClient
          .getResumeCourses(userId, 20)
          .then((rows) => rows.find((r) => r.courseid === courseId)?.progress)
          .catch(() => undefined);
      }

      const input = buildActivityInput(draft, { progressPercentAtEnd });

      // EXPは通信結果に依存させない。activityId はタイマー開始時に確定しているので、
      // POSTが失敗しても・再送しても同じ eventId になり二重加算されない。
      awardExp(
        `activity:${input.id}`,
        Math.max(1, Math.round(input.session.durationMinutes / 5)) *
          EXP_RULES.STUDY_SESSION_PER_5MIN
      );
      bumpActivityRevision();

      // TODO(backend未実装): StudyActivity（カテゴリ別内訳・目標・達成度等）を保存する
      //   実テーブルが無いため、サーバーへPOSTせずローカルで組み立てて返すだけに留める。
      //   終了画面の演出（達成カード等）はこれで動くが、リロード後の学習履歴一覧
      //   （studyLog/StudyLogList 等）には反映されない。
      const activity: StudyActivity = {
        ...input,
        userId,
        social: { visibility: 'private', reactionCounts: {}, myReactions: [], commentCount: 0 },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        schemaVersion: 1,
      };
      return activity;
    },
    [userId, clearSession, setFinishDraft, zeroOutLastSegment, bumpActivityRevision, awardExp]
  );

  const remainingSeconds = useMemo(
    () => (session ? sessionRemainingSeconds(session) : null),
    // elapsedSeconds を依存に入れて1秒ごとに再計算する
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, elapsedSeconds]
  );

  const segmentTotals = useMemo(
    () => (session ? sessionSegmentTotals(session) : []),
    // 内訳も毎秒動く（進行中の区間が伸びるため）
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, elapsedSeconds]
  );

  return {
    session,
    elapsedSeconds,
    remainingSeconds,
    ratio: dialRatio(session, elapsedSeconds),
    running: !!session && session.pausedAt === null,
    reachedTarget: !!session && session.targetReachedAt !== null,
    stale: !!session && isStaleSession(session),
    // elapsedSeconds を依存に持つ再計算の中で評価されるので、毎秒判定が更新される
    idle: !!session && isIdleSession(session),
    segmentTotals,
    start,
    pause: pauseSession,
    resume: resumeSession,
    switchCategory,
    trimToLastActive,
    discard,
    updateGoal: updateGoalInStore,
    prepareFinish,
    cancelFinish,
    commitFinish,
    finishDraft,
  };
}

export default useStudySession;
