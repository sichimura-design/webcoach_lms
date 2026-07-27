import { useState, useEffect, useCallback } from 'react';
import { bffClient } from '../services/bffClient';
import { Journey } from '../types/mypage';

export function useJourney(userId: number | undefined) {
  const [journey, setJourney] = useState<Journey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return bffClient.getJourney(userId)
      .then((data) => {
        setJourney(data);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err.message || '読み込みに失敗しました');
        setLoading(false);
      });
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { journey, loading, error, reload };
}
