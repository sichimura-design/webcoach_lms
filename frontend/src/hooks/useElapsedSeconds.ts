import { useEffect, useState } from 'react';
import { ActiveStudySession } from '../types/studyActivity';

export function sessionElapsedSeconds(s: ActiveStudySession, now: number = Date.now()): number {
  const end = s.pausedAt ?? now;
  return Math.max(0, Math.floor((end - s.startedAt) / 1000));
}

/**
 * 実行中セッションの経過秒を1秒ごとに更新する。
 */
export function useElapsedSeconds(session: ActiveStudySession | null): number {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!session) {
      setElapsedSeconds(0);
      return;
    }
    const tick = () => setElapsedSeconds(sessionElapsedSeconds(session));
    tick();
    if (session.pausedAt !== null) return; // 一時停止中はintervalを張らない
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session]);

  return elapsedSeconds;
}

export default useElapsedSeconds;
