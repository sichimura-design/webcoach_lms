/**
 * frontend/src/hooks/useEnrollment.ts
 * 受講の期間（受講開始日・卒業予定日）の読み取り。学習の記録のヘッダーが使う。
 *
 * このリポジトリには react-query / SWR が入っていないため、
 * useLearningPlan.ts と同じ手書きの useState + useEffect 形に揃える。
 *
 * 🔴 失敗を error として外に出さない。実BFF（本番）にこのAPIは無いので、
 *    取得できないのが正常な状態のひとつ。呼び出し側は graduationDate が null なら
 *    卒業予定のピルを描かないだけにする（学習の記録本体は必ず出す）。
 */
import { useEffect, useState } from 'react';
import { bffClient } from '../services/bffClient';
import { Enrollment } from '../types/enrollment';

export interface UseEnrollmentResult {
  /** 取れなければ null（本番＝モックOFF では常に null） */
  enrollment: Enrollment | null;
  loading: boolean;
}

export function useEnrollment(userId: number | undefined): UseEnrollmentResult {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    bffClient
      .getEnrollment(userId)
      .then((data) => {
        if (!cancelled) setEnrollment(data);
      })
      // 実BFF未対応・未ログインでも学習の記録側は出す
      .catch(() => {
        if (!cancelled) setEnrollment(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { enrollment, loading };
}
