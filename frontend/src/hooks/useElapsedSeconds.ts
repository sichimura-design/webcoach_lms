import { useEffect, useState } from 'react';
import { ActiveStudySession } from '../types/studyActivity';
import { sessionElapsedSeconds } from '../utils/studyStats';

/**
 * 実行中セッションの経過秒を1秒ごとに更新する。
 *
 * 集中ブース・フローティングタイマー・教材ページのミニタイマーが同じ数字を出すために共有する。
 * （以前は useStudySession と FloatingStudyTimer に同じ tick が二重に書かれていた）
 * 経過の計算そのものは utils/studyStats.ts の sessionElapsedSeconds が唯一の実装。
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
