import { useState, useEffect, useCallback } from 'react';
import { bffClient } from '../services/bffClient';
import { CoachingGoalApi } from '../types/mypage';

export interface Goal {
  no: number | null;
  text: string;
  completed: boolean;
}

function fromApi(raw: CoachingGoalApi): Goal {
  return {
    no: raw.no,
    text: raw.description,
    completed: raw.is_completed === 1,
  };
}

export function useCoachingGoals(userId: number | undefined) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    bffClient.getNextCoachingGoals(userId)
      .then(raw => {
        setGoals(raw.map(fromApi));
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err.message || '読み込みに失敗しました');
        setLoading(false);
      });
  }, [userId]);

  const saveGoals = useCallback(async (updatedGoals: Goal[]) => {
    if (!userId) return;
    setSaving(true);

    // null の no に新しい no を採番
    const maxNo = updatedGoals.reduce((m, g) => g.no !== null ? Math.max(m, g.no) : m, 0);
    let nextNo = maxNo + 1;
    const payload = updatedGoals.map(g => ({
      no: g.no ?? nextNo++,
      description: g.text,
      is_completed: (g.completed ? 1 : 0) as 0 | 1,
    }));

    // 楽観的更新
    setGoals(updatedGoals);

    try {
      const result = await bffClient.updateNextCoachingGoals(userId, payload);
      setGoals(result.map(fromApi));
    } catch (err: any) {
      setError(err.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }, [userId]);

  return { goals, loading, saving, error, saveGoals };
}
