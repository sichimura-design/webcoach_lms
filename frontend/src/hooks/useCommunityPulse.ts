import { useState, useEffect } from 'react';
import { bffClient } from '../services/bffClient';
import { CommunityPulse } from '../types/mypage';

const CACHE_KEY = 'webcoach-community-pulse-cache';
// 1〜2時間おきの更新でも十分な情報のため、頻繁な再取得は行わない
const REFRESH_INTERVAL_MS = 90 * 60 * 1000; // 1.5時間

interface CachedPulse {
  data: CommunityPulse;
  fetchedAt: number;
}

function readCache(): CachedPulse | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(data: CommunityPulse): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, fetchedAt: Date.now() }));
  } catch {
    /* localStorage不可の環境では無視 */
  }
}

export function useCommunityPulse() {
  const [pulse, setPulse] = useState<CommunityPulse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = readCache();
    // rooms の形をあとから変えた際に、古い形のキャッシュを信じて使ってしまう事故を防ぐ
    const isValidShape = !!cached && Array.isArray(cached.data.rooms) &&
      cached.data.rooms.every((r) => typeof r.activityLabel === 'string' && typeof r.id === 'string');
    const isFresh = isValidShape && Date.now() - cached!.fetchedAt < REFRESH_INTERVAL_MS;

    if (isFresh && cached) {
      setPulse(cached.data);
      setLoading(false);
      return;
    }

    bffClient.getCommunityPulse()
      .then(data => {
        setPulse(data);
        writeCache(data);
        setLoading(false);
      })
      .catch(() => {
        // 取得失敗時はキャッシュがあればそれを表示する（無ければ非表示のまま）
        if (cached) setPulse(cached.data);
        setLoading(false);
      });
  }, []);

  return { pulse, loading };
}
