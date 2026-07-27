import { useEffect, useState } from 'react';
import { useStudyTimerStore } from '../store/studyTimerStore';
import { useProgressionStore } from '../store/progressionStore';
import { bffClient } from '../services/bffClient';
import { StudySessionMode } from '../types/studyRoom';
import { EXP_RULES } from '../utils/progression';

interface StartParams {
  mode: StudySessionMode;
  targetMinutes?: number;
  courseId?: number;
  courseTitle?: string;
}

export function useStudySession(userId: number | undefined) {
  const session = useStudyTimerStore((s) => s.session);
  const startSession = useStudyTimerStore((s) => s.startSession);
  const clearSession = useStudyTimerStore((s) => s.clearSession);
  const pauseSession = useStudyTimerStore((s) => s.pauseSession);
  const resumeSession = useStudyTimerStore((s) => s.resumeSession);
  const awardExp = useProgressionStore((s) => s.awardExp);

  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!session) {
      setElapsedSeconds(0);
      return;
    }
    const tick = () => {
      const end = session.pausedAt ?? Date.now();
      setElapsedSeconds(Math.floor((end - session.startedAt) / 1000));
    };
    tick();
    if (session.pausedAt !== null) return; // 一時停止中はintervalを張らない
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session]);

  const start = (params: StartParams) => startSession(params);

  const stop = async () => {
    if (!session || !userId) {
      clearSession();
      return null;
    }
    const endRef = session.pausedAt ?? Date.now();
    const durationMinutes = Math.max(1, Math.round((endRef - session.startedAt) / 60000));
    const startedAtIso = new Date(session.startedAt).toISOString();
    const endedAtIso = new Date().toISOString();
    clearSession();
    try {
      const record = await bffClient.recordStudySession(userId, {
        mode: session.mode,
        targetMinutes: session.targetMinutes,
        courseId: session.courseId,
        courseTitle: session.courseTitle,
        durationMinutes,
        startedAt: startedAtIso,
        endedAt: endedAtIso,
      });
      awardExp(`session:${record.id}`, Math.max(1, Math.round(durationMinutes / 5)) * EXP_RULES.STUDY_SESSION_PER_5MIN);
      return record;
    } catch {
      return null;
    }
  };

  return { session, elapsedSeconds, start, stop, pauseSession, resumeSession };
}
