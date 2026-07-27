import { useState, useEffect } from 'react';
import { bffClient } from '../services/bffClient';
import { RankingEntry, RankingType } from '../types/focusBooth';

export function useFocusBoothRanking(type: RankingType) {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    bffClient.getFocusBoothRanking(type)
      .then((data) => {
        setRanking(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [type]);

  return { ranking, loading };
}
