import { useCallback, useEffect, useRef, useState } from 'react';
import { useStudyTimerStore } from '../store/studyTimerStore';
import { bffClient } from '../services/bffClient';
import { ActiveStudySession, StudyFinishDraft, StudySession, StudySessionMode } from '../types/studyActivity';
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
  commitFinish: (actualMinutes?: number) => Promise<StudySession | null>;
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

  // 起動時: localStorageに無くても、サーバーに進行中セッションがあれば復元する。
  // タブを閉じた/別画面から戻った/localStorageが消えた場合でも、サーバー側(webcoach_study_activity
  // のin_progress行)を正としてタイマー状態を継続できるようにする。
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
        const local = useStudyTimerStore.getState().session;
        if (local && local.sessionId === active.id) return;

        restoreFromServer({
          sessionId: active.id,
          mode: active.target_minutes ? 'pomodoro' : 'freeform',
          targetMinutes: active.target_minutes ?? undefined,
          courseId: active.courseid ?? undefined,
          courseTitle: active.course_title ?? undefined,
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
    pauseSession();
  }, [session, elapsedSeconds, markTargetReached, pauseSession]);

  const start = useCallback(
    async (params: StartParams) => {
      if (!userId) return;
      setStarting(true);
      try {
        const created = await bffClient.startStudySession(userId, {
          courseid: params.courseId,
          course_title: params.courseTitle,
          target_minutes: params.targetMinutes,
        });
        startSessionInStore({
          sessionId: created.id,
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

  const discard = useCallback(() => {
    setFinishDraft(null);
    clearSession();
  }, [clearSession, setFinishDraft]);

  const prepareFinish = useCallback(() => {
    if (!session) return;
    // 先に一時停止する。カードを見ている間もカウントが進むと数字がずれる。
    const endAt = session.pausedAt ?? Date.now();
    if (session.pausedAt === null) pauseSession();
    const measuredSeconds = Math.max(0, Math.floor((endAt - session.startedAt) / 1000));

    setFinishDraft({
      sessionId: session.sessionId,
      measuredSeconds,
      actualMinutes: Math.max(1, Math.round(measuredSeconds / 60)),
      pausedSeconds: Math.round(session.pausedTotalMs / 1000),
      mode: session.mode,
      targetMinutes: session.targetMinutes,
      courseTitle: session.courseTitle,
      completedTarget: session.targetReachedAt !== null,
    });
  }, [session, pauseSession, setFinishDraft]);

  const cancelFinish = useCallback(() => setFinishDraft(null), [setFinishDraft]);

  const commitFinish = useCallback(
    async (actualMinutes?: number): Promise<StudySession | null> => {
      const draft = useStudyTimerStore.getState().finishDraft;
      if (!draft || !userId) {
        setFinishDraft(null);
        clearSession();
        return null;
      }
      const finalMinutes = actualMinutes ?? draft.actualMinutes;

      // 数秒の誤操作を記録しない(丸めた1分が積み上がると「学習した日」が誤って成立する)
      const untouched = finalMinutes === Math.max(1, Math.round(draft.measuredSeconds / 60));
      if (draft.measuredSeconds < MIN_RECORDABLE_SECONDS && untouched) {
        setFinishDraft(null);
        clearSession();
        return null;
      }

      setFinishDraft(null);
      clearSession();

      try {
        return await bffClient.finishStudySession(userId, draft.sessionId, {
          duration_minutes: Math.max(0, finalMinutes),
          paused_seconds: draft.pausedSeconds,
        });
      } catch {
        // 送信に失敗してもUIは「終了した」状態に進める(タイマーには戻さない)
        return null;
      }
    },
    [userId, clearSession, setFinishDraft]
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
    pause: pauseSession,
    resume: resumeSession,
    discard,
    prepareFinish,
    cancelFinish,
    commitFinish,
    finishDraft,
  };
}
