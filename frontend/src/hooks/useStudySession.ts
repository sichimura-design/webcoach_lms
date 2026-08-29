import { useCallback, useEffect, useRef, useState } from 'react';
import { useStudyTimerStore } from '../store/studyTimerStore';
import { bffClient } from '../services/bffClient';
import { ActiveStudySession, StudyFinishDraft, StudySessionMode } from '../types/studyActivity';
import { useElapsedSeconds } from './useElapsedSeconds';

export interface StartParams {
  mode: StudySessionMode;
  /** ポモドーロの設定時間。通常タイマーでも「目安」として保持する */
  targetMinutes?: number;
  courseId?: number;
  courseTitle?: string;
}

/** 一時停止したまま/動かしたまま長時間放置されたと見なす時間(タイマーの消し忘れ警告用) */
const STALE_SESSION_MS = 12 * 60 * 60 * 1000;
/** これ未満は記録しない(誤操作の数秒が「学習した日」を成立させないため) */
const MIN_RECORDABLE_SECONDS = 60;
/**
 * 記録を破棄する際、直前に閉じたMoodleログ上のセグメントを実質ゼロ分に補正するための
 * 十分大きな負の補正値。GREATEST(0, 実測分 + delta)で必ず0にクランプされる
 * (1回のセグメントがこれを上回る分数になることは無い)。
 */
const DISCARD_DELTA_MINUTES = -100000;

export interface UseStudySession {
  session: ActiveStudySession | null;
  elapsedSeconds: number;
  /** ポモドーロのみ。通常タイマーは残り時間の概念が無いのでnull */
  remainingSeconds: number | null;
  /** 円形ダイヤルの塗り割合(0..1) */
  ratio: number;
  running: boolean;
  reachedTarget: boolean;
  stale: boolean;
  starting: boolean;

  start: (params: StartParams) => Promise<void>;
  pause: () => void;
  resume: () => void;
  /** 記録せずに破棄して未開始に戻す */
  discard: () => void;

  /** 「終了」。計測を止めて下書きを作るだけ。まだ記録しない */
  prepareFinish: () => void;
  /** 下書きを捨てて計測に戻る(一時停止のまま残る) */
  cancelFinish: () => void;
  /** 「そのまま記録」「時間を修正して記録」の両方がこれを呼ぶ */
  commitFinish: (actualMinutes?: number) => Promise<void>;
  finishDraft: StudyFinishDraft | null;
}

export function useStudySession(userId: number | undefined): UseStudySession {
  const session = useStudyTimerStore((s) => s.session);
  const finishDraft = useStudyTimerStore((s) => s.finishDraft);
  const startSessionInStore = useStudyTimerStore((s) => s.startSession);
  const clearSession = useStudyTimerStore((s) => s.clearSession);
  const pauseSession = useStudyTimerStore((s) => s.pauseSession);
  const resumeSession = useStudyTimerStore((s) => s.resumeSession);
  const markTargetReached = useStudyTimerStore((s) => s.markTargetReached);
  const setFinishDraft = useStudyTimerStore((s) => s.setFinishDraft);
  const restoreFromServer = useStudyTimerStore((s) => s.restoreFromServer);

  const [starting, setStarting] = useState(false);
  const elapsedSeconds = useElapsedSeconds(session);

  // 起動時: localStorageに無くても、サーバー(Moodleログ)に進行中セッションがあれば復元する。
  // タブを閉じた/別画面から戻った/localStorageが消えた場合でも、直近のstudy_session_startedに
  // 対応するendedがまだ無ければ、それを正としてタイマー状態を継続できるようにする。
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
          mode: 'freeform',
          targetMinutes: undefined,
          courseId: active.courseid ?? undefined,
          courseTitle: undefined,
          startedAt: new Date(active.started_at).getTime(),
          pausedAt: null,
          pausedCount: 0,
          pausedTotalMs: 0,
          targetReachedAt: null,
        });
      })
      .catch(() => {
        // 復元に失敗してもタイマー未開始として振る舞えばよい
      });
  }, [userId, clearSession, restoreFromServer]);

  // 一時停止のたびにstudy_session_ended、再開のたびに新しいstudy_session_startedを
  // Moodleへベストエフォートで送る(ローカルのタイマー状態は同期的に即座に更新する)。
  const pause = useCallback(() => {
    const current = useStudyTimerStore.getState().session;
    pauseSession();
    if (userId) {
      bffClient.endStudySession(userId, current?.courseId).catch(() => {});
    }
  }, [userId, pauseSession]);

  const resume = useCallback(() => {
    const current = useStudyTimerStore.getState().session;
    resumeSession();
    if (userId) {
      bffClient.startStudySession(userId, current?.courseId).catch(() => {});
    }
  }, [userId, resumeSession]);

  // ポモドーロ完了の検知。ref でガードして1回だけ処理する
  const targetHandledRef = useRef<number | null>(null);
  useEffect(() => {
    if (!session) {
      targetHandledRef.current = null;
      return;
    }
    if (session.targetReachedAt !== null) return;
    if (targetHandledRef.current === session.sessionId) return;
    if (session.mode !== 'pomodoro' || !session.targetMinutes) return;
    if (elapsedSeconds < session.targetMinutes * 60) return;

    targetHandledRef.current = session.sessionId;
    markTargetReached();
    // 自動記録はしない。一時停止するだけにして、記録するか続けるかは受講生が決める。
    pause();
  }, [session, elapsedSeconds, markTargetReached, pause]);

  const start = useCallback(
    async (params: StartParams) => {
      if (!userId) return;
      setStarting(true);
      try {
        await bffClient.startStudySession(userId, params.courseId);
        startSessionInStore({
          sessionId: Date.now(),
          mode: params.mode,
          targetMinutes: params.targetMinutes,
          courseId: params.courseId,
          courseTitle: params.courseTitle,
        });
      } finally {
        setStarting(false);
      }
    },
    [userId, startSessionInStore]
  );

  /** 直前に閉じたセグメントを実質ゼロ分に補正する(discard・極端に短い記録の破棄で共用) */
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
    // 先に一時停止する(=study_session_endedを送る)。カードを見ている間もカウントが進むと数字がずれる。
    const endAt = session.pausedAt ?? Date.now();
    if (session.pausedAt === null) pause();
    const measuredSeconds = Math.max(0, Math.floor((endAt - session.startedAt) / 1000));

    setFinishDraft({
      sessionId: session.sessionId,
      measuredSeconds,
      actualMinutes: Math.max(1, Math.round(measuredSeconds / 60)),
      pausedSeconds: Math.round(session.pausedTotalMs / 1000),
      mode: session.mode,
      targetMinutes: session.targetMinutes,
      courseId: session.courseId,
      courseTitle: session.courseTitle,
      completedTarget: session.targetReachedAt !== null,
    });
  }, [session, pause, setFinishDraft]);

  const cancelFinish = useCallback(() => setFinishDraft(null), [setFinishDraft]);

  const commitFinish = useCallback(
    async (actualMinutes?: number): Promise<void> => {
      const draft = useStudyTimerStore.getState().finishDraft;
      if (!draft || !userId) {
        setFinishDraft(null);
        clearSession();
        return;
      }
      const naturalMinutes = Math.max(1, Math.round(draft.measuredSeconds / 60));
      const finalMinutes = actualMinutes ?? draft.actualMinutes;
      const untouched = finalMinutes === naturalMinutes;

      setFinishDraft(null);
      clearSession();

      // 数秒の誤操作は記録しない(丸めた1分が積み上がると「学習した日」が誤って成立する)。
      // ended事件は既にprepareFinish/pauseで送信済みなので、実質ゼロ分に補正する。
      if (draft.measuredSeconds < MIN_RECORDABLE_SECONDS && untouched) {
        zeroOutLastSegment(draft.courseId);
        return;
      }

      if (!untouched) {
        const deltaMinutes = Math.max(0, finalMinutes) - naturalMinutes;
        bffClient.correctStudySession(userId, deltaMinutes, draft.courseId).catch(() => {});
      }
    },
    [userId, clearSession, setFinishDraft, zeroOutLastSegment]
  );

  const remainingSeconds =
    session && session.mode === 'pomodoro' && session.targetMinutes
      ? Math.max(0, session.targetMinutes * 60 - elapsedSeconds)
      : null;

  const ratio = (() => {
    if (!session) return 0;
    if (session.mode === 'pomodoro' && session.targetMinutes) {
      const total = session.targetMinutes * 60;
      return Math.max(0, Math.min(1, (total - elapsedSeconds) / total));
    }
    return (elapsedSeconds % 60) / 60;
  })();

  return {
    session,
    elapsedSeconds,
    remainingSeconds,
    ratio,
    running: !!session && session.pausedAt === null,
    reachedTarget: !!session && session.targetReachedAt !== null,
    stale: !!session && Date.now() - (session.pausedAt ?? session.startedAt) > STALE_SESSION_MS,
    starting,
    start,
    pause,
    resume,
    discard,
    prepareFinish,
    cancelFinish,
    commitFinish,
    finishDraft,
  };
}
