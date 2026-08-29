import { useState, useEffect, useCallback } from 'react';
import { bffClient } from '../services/bffClient';
import { FocusBoothMember, FocusBoothPulse } from '../types/focusBooth';

export function useFocusBoothMembers() {
  const [members, setMembers] = useState<FocusBoothMember[]>([]);
  const [pulse, setPulse] = useState<FocusBoothPulse | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    return Promise.all([bffClient.getFocusBoothMembers(), bffClient.getFocusBoothPulse()])
      .then(([m, p]) => {
        setMembers(m);
        setPulse(p);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const cheer = useCallback(async (memberId: string) => {
    // 楽観的更新
    setMembers((prev) => prev.map((m) => (m.id === memberId && !m.cheeredByMe ? { ...m, hearts: m.hearts + 1, cheeredByMe: true } : m)));
    setPulse((prev) => (prev ? { ...prev, myCheerCountToday: prev.myCheerCountToday + 1 } : prev));
    try {
      const updated = await bffClient.cheerFocusBoothMember(memberId);
      setMembers((prev) => prev.map((m) => (m.id === memberId ? updated : m)));
    } catch {
      /* 楽観的更新のままにする（モック環境のため） */
    }
  }, []);

  return { members, pulse, loading, cheer };
}
