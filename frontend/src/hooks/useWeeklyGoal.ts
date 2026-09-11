import { useCallback, useEffect, useState } from 'react';
import { bffClient } from '../services/bffClient';

/**
 * 週間の学習時間目標（分）。トップページ 8a の「今週の目標」で使う。
 *
 * 保存先は Profile.weekly_target_minutes（webcoach_user_profileテーブル、
 * POST /api/updateprofile/{userid} 経由で永続化される。2026-09-11に実装)。
 * 画面上は保存の成否を待たず先に値を更新する（楽観的更新）。通信失敗時も
 * 画面の値は戻さない（保存はリトライされないので、次回保存操作まではその値のまま）。
 *
 * 30分きざみに丸めるのは 8a のステッパー（−／＋）の刻みに合わせるため。
 */

/** 既定は週10時間。types/api.ts と mocks/handlers.ts の初期値と揃えること */
export const DEFAULT_WEEKLY_GOAL_MINUTES = 600;

/** ステッパーの刻み。8a の「30分きざみで調整できます」 */
export const WEEKLY_GOAL_STEP_MINUTES = 30;

const MIN_MINUTES = 30;
const MAX_MINUTES = 60 * 40; // 週40時間。これ以上は現実的な学習計画ではない

export function clampWeeklyGoal(minutes: number): number {
  const stepped = Math.round(minutes / WEEKLY_GOAL_STEP_MINUTES) * WEEKLY_GOAL_STEP_MINUTES;
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, stepped));
}

export interface UseWeeklyGoal {
  /** 現在の目標（分） */
  goalMinutes: number;
  saving: boolean;
  /** 目標を保存する。失敗しても画面上の値は変えたままにする */
  save: (minutes: number) => Promise<void>;
}

export function useWeeklyGoal(
  userId: number | undefined,
  initialMinutes: number | null | undefined
): UseWeeklyGoal {
  const [goalMinutes, setGoalMinutes] = useState(
    () => clampWeeklyGoal(initialMinutes ?? DEFAULT_WEEKLY_GOAL_MINUTES)
  );
  const [saving, setSaving] = useState(false);
  // 保存後にプロフィールを取り直すと initialMinutes が変わって上書きが起きるので、
  // 「まだ一度も保存していない間だけ」プロフィール側の値に追従する
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (touched) return;
    if (initialMinutes == null) return;
    setGoalMinutes(clampWeeklyGoal(initialMinutes));
  }, [initialMinutes, touched]);

  const save = useCallback(
    async (minutes: number) => {
      const next = clampWeeklyGoal(minutes);
      setGoalMinutes(next);
      setTouched(true);
      if (!userId) return;
      setSaving(true);
      try {
        await bffClient.updateUserProfile(userId, { weekly_target_minutes: next });
      } catch {
        /* 通信失敗時も画面の値は戻さない（上のコメント参照） */
      } finally {
        setSaving(false);
      }
    },
    [userId]
  );

  return { goalMinutes, saving, save };
}
