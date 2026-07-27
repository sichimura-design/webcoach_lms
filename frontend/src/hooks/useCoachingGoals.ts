import { useState, useEffect, useCallback } from 'react';
import { bffClient } from '../services/bffClient';
import { CoachingGoalApi } from '../types/mypage';
import { useProgressionStore } from '../store/progressionStore';
import { EXP_RULES } from '../utils/progression';

export interface Goal {
  no: number | null;
  text: string;
  progress: number; // 0-100
  completed: boolean; // progress>=100から導出する派生値
}

function deriveProgress(raw: CoachingGoalApi): number {
  return raw.progress ?? (raw.is_completed === 1 ? 100 : 0);
}

function fromApi(raw: CoachingGoalApi): Goal {
  const progress = deriveProgress(raw);
  return {
    no: raw.no,
    text: raw.description,
    progress,
    completed: progress >= 100,
  };
}

/**
 * 保存後の目標リストから「今日のスモールステップ」「今日のTODO」を
 * ルールベースで導出し、連動して更新する（AIなし・シンプル方式）。
 * - スモールステップ: 表示順で最初に見つかった未完了目標のテキストをそのまま反映
 *   （未完了目標が無ければ既存値を保持し、更新しない）
 * - 今日のTODO: 目標リスト全体をそのまま1:1でTODOに反映（完了状態も引き継ぐ）
 * 失敗しても目標保存自体には影響させないため、呼び出し元で握りつぶす。
 */
async function syncLinkedDisplays(userId: number, updatedGoals: Goal[]): Promise<void> {
  const focusGoal = updatedGoals.find(g => !g.completed);

  const tasks: Promise<unknown>[] = [
    bffClient.updateDailyTodos(
      userId,
      updatedGoals.map((g, i) => ({ id: g.no ?? i, text: g.text, done: g.completed }))
    ),
  ];

  if (focusGoal) {
    tasks.push(bffClient.updateUserProfile(userId, { today_small_step: focusGoal.text }));
  }

  await Promise.all(tasks);
}

export function useCoachingGoals(userId: number | undefined, onLinkedUpdate?: () => void) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const awardExp = useProgressionStore((s) => s.awardExp);

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
      progress: g.progress,
      is_completed: (g.progress >= 100 ? 1 : 0) as 0 | 1,
    }));

    const previousGoals = goals;

    // 楽観的更新
    setGoals(updatedGoals);

    try {
      const result = await bffClient.updateNextCoachingGoals(userId, payload);
      const savedGoals = result.map(fromApi);
      setGoals(savedGoals);

      // 新たに100%に達した目標だけEXPを付与（二重加算はawardExp側のeventIdで防止）
      savedGoals.forEach((g) => {
        if (g.no === null || g.progress < 100) return;
        const prev = previousGoals.find((p) => p.no === g.no);
        if (prev && prev.progress >= 100) return; // 既に完了済みだった
        awardExp(`goal:${userId}:${g.no}`, EXP_RULES.GOAL_COMPLETE);
      });

      // 「今日のスモールステップ」「今日のTODO」への連動反映（失敗しても目標保存自体は成功扱い）
      try {
        await syncLinkedDisplays(userId, savedGoals);
        onLinkedUpdate?.();
      } catch {
        /* 連動反映の失敗は握りつぶす */
      }
    } catch (err: any) {
      setError(err.message || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }, [userId, onLinkedUpdate, goals, awardExp]);

  return { goals, loading, saving, error, saveGoals };
}
