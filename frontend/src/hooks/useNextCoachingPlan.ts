import { useEffect, useState } from 'react';
import { bffClient } from '../services/bffClient';
import { CoachingGoalApi } from '../types/mypage';

export interface PlanItem {
  no: number;
  text: string;
  completed: boolean;
}

interface NextSession {
  date: string;
  coach: string;
}

function fromApi(raw: CoachingGoalApi): PlanItem {
  const progress = raw.progress ?? (raw.is_completed === 1 ? 100 : 0);
  return { no: raw.no, text: raw.description, completed: progress >= 100 };
}

/**
 * コーチが設定した「次回コーチングまでの目標」を読み取り専用で取得する。
 * 学習者側での編集・並べ替え・進捗調整は行わない（CoachingGoals.tsxの編集UIは廃止）。
 */
export function useNextCoachingPlan(userId: number | undefined) {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [nextSession, setNextSession] = useState<NextSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      bffClient.getNextCoachingGoals(userId),
      bffClient.getCoachingSessions(userId),
    ])
      .then(([goals, sessions]) => {
        setItems(goals.map(fromApi));
        setNextSession(sessions.next ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  return { items, nextSession, loading };
}
