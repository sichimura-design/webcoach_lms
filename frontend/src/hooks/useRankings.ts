import { useEffect, useState } from 'react';
import { bffClient } from '../services/bffClient';
import {
  StreakRanking,
  StreakRankingPeriod,
  StudyRanking,
  StudyRankingPeriod,
} from '../types/focusBooth';
import { useStudyTimerStore } from '../store/studyTimerStore';

/**
 * 学習時間ランキング／ストリークランキングの取得。
 *
 * マイページ（学習時間チャレンジ・みんなのランキング）と学習記録ページの
 * 3箇所が同じフェッチを書いていたので hook に寄せた。
 * react-query / SWR がこのリポジトリに無いため、useStudyStats.ts と同じ
 * 手書きの useState + useEffect 形に揃える。
 *
 * 🔴 activityRevision を依存に入れる。学習セッションが保存されたら
 *    自分の行が動かないと「記録が反映されている」体験が確認できない。
 * 🔴 並べ替えはしない。順位はサーバ役（MSW）が確定させたものをそのまま描く。
 */
interface RankingResult<T> {
  ranking: T | null;
  loading: boolean;
  /** 取得できなかった = 本番で実BFFにこのAPIが無い、または通信失敗 */
  failed: boolean;
}

function useRanking<T>(
  userId: number | undefined,
  key: string,
  fetcher: () => Promise<T>
): RankingResult<T> {
  const [ranking, setRanking] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const activityRevision = useStudyTimerStore((s) => s.activityRevision);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    fetcher()
      .then((r) => {
        if (cancelled) return;
        setRanking(r);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // fetcher は毎レンダーで作り直されるので依存に入れない。
    // 取得条件は userId / key（＝期間）/ activityRevision の3つで足りる。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, key, activityRevision]);

  return { ranking, loading, failed };
}

export function useStudyRanking(
  userId: number | undefined,
  period: StudyRankingPeriod
): RankingResult<StudyRanking> {
  return useRanking(userId, `time:${period}`, () => bffClient.getStudyRanking(userId!, period));
}

export function useStreakRanking(
  userId: number | undefined,
  period: StreakRankingPeriod
): RankingResult<StreakRanking> {
  return useRanking(userId, `streak:${period}`, () => bffClient.getStreakRanking(userId!, period));
}
