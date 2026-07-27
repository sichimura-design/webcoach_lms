import { useState, useEffect, useCallback } from 'react';
import { bffClient } from '../services/bffClient';
import { DailyTodo } from '../types/mypage';
import { useProgressionStore } from '../store/progressionStore';
import { EXP_RULES } from '../utils/progression';

export function useDailyTodos(userId: number | undefined) {
  const [todos, setTodos] = useState<DailyTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const awardExp = useProgressionStore((s) => s.awardExp);

  const reload = useCallback(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return bffClient.getDailyTodos(userId)
      .then(raw => {
        setTodos(raw);
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

  const toggleTodo = useCallback(async (id: number) => {
    if (!userId) return;
    const target = todos.find(t => t.id === id);
    const updated = todos.map(t => t.id === id ? { ...t, done: !t.done } : t);
    setTodos(updated); // 楽観的更新

    if (target && !target.done) {
      const today = new Date().toISOString().slice(0, 10);
      awardExp(`todo:${userId}:${id}:${today}`, EXP_RULES.TODO_COMPLETE);
    }

    try {
      const result = await bffClient.updateDailyTodos(userId, updated);
      setTodos(result);
    } catch (err: any) {
      setError(err.message || '更新に失敗しました');
    }
  }, [userId, todos, awardExp]);

  return { todos, loading, error, toggleTodo, reload };
}
