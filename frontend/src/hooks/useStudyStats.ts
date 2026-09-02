import { useCallback, useEffect, useState } from 'react';
import { bffClient } from '../services/bffClient';
import { StudyStatsSummary } from '../types/studyActivity';
import { useStudyTimerStore } from '../store/studyTimerStore';

/**
 * 今日/今週/今月の学習時間・セッション数・最長集中・ストリーク・日別・教材別・最近の履歴。
 *
 * react-query / SWR がこのリポジトリに無いため、useLearningPlan.ts と同じ
 * 手書きの useState + useEffect 形に揃える。
 */
export interface UseStudyStatsResult {
  stats: StudyStatsSummary | null;
  loading: boolean;
  /**
   * 取得できなかった = モックOFF（本番）で実BFFにこのAPIが無い、または通信失敗。
   * 🔴 エラー文言ではなくこのフラグを返すのは、本番で赤いエラーが出続けるのを避けるため。
   *    呼び出し側は「統計セクションを出さない」に縮退させる（タイマー自体は動く）。
   */
  unavailable: boolean;
  reload: () => void;
}

/**
 * @param days 'all' なら最初の記録の日から今日まで。/study-log はこれで呼び、
 *   カレンダーの月送り・期間タブ・月別グラフを1回の応答から切り出す。
 *   マイページは既定の 35 のまま（必要なのは直近だけなので広げない）。
 */
export function useStudyStats(
  userId: number | undefined,
  days: number | 'all' = 35
): UseStudyStatsResult {
  const [stats, setStats] = useState<StudyStatsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [trigger, setTrigger] = useState(0);
  // 記録が保存されるたびに全画面を同期させる
  const activityRevision = useStudyTimerStore((s) => s.activityRevision);

  const reload = useCallback(() => setTrigger((t) => t + 1), []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    bffClient
      .getStudyStats(userId, days)
      .then((s) => {
        if (cancelled) return;
        setStats(s);
        setUnavailable(false);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setStats(null);
        setUnavailable(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, days, trigger, activityRevision]);

  return { stats, loading, unavailable, reload };
}

export default useStudyStats;
