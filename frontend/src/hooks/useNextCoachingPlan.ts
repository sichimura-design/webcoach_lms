import { useCallback, useEffect, useState } from 'react';
import { bffClient } from '../services/bffClient';
import { CoachingGoalApi } from '../types/mypage';

export interface PlanItem {
  no: number;
  text: string;
  completed: boolean;
  progress: number;
  /**
   * 達成した日時（ISO8601）。実BFFはこの項目を返さないため本番では常に null。
   * 表示側は null を前提にフォールバックすること。
   */
  completedAt: string | null;
  /**
   * 所要時間の目安（分）。実BFFはこの項目を返さないため本番では常に null。
   * 表示側は null のとき「目安」行ごと省くこと。
   */
  estimatedMinutes: number | null;
}

interface NextSession {
  date: string;
  coach: string;
}

function fromApi(raw: CoachingGoalApi): PlanItem {
  const progress = raw.progress ?? (raw.is_completed === 1 ? 100 : 0);
  return {
    no: raw.no,
    text: raw.description,
    completed: progress >= 100,
    progress,
    completedAt: raw.completed_at ?? null,
    estimatedMinutes: raw.estimated_minutes ?? null,
  };
}

function toApi(item: PlanItem, index: number) {
  return {
    // no は表示順そのものなので、削除で歯抜けにならないよう毎回振り直す
    no: index + 1,
    description: item.text,
    is_completed: (item.completed ? 1 : 0) as 0 | 1,
    progress: item.completed ? 100 : Math.min(99, item.progress),
  };
}

export interface UseNextCoachingPlan {
  items: PlanItem[];
  nextSession: NextSession | null;
  loading: boolean;
  /** 保存中（ボタンを二度押しさせないため） */
  saving: boolean;
  error: string | null;
  reload: () => void;
  /** 一覧を丸ごと保存する。呼び出し側は編集後の配列を渡す */
  save: (next: PlanItem[]) => Promise<boolean>;
}

/**
 * 「次回コーチングまでの目標」の取得と保存。
 *
 * 目標はコーチングノートで「確定」したものが自動で入ってくる
 * （モックでは mocks/coachingGoalsStore.ts が両者をつないでいる）。
 * 受講生はこのカード上で文言の修正・完了チェック・追加・削除ができる。
 *
 * react-query / SWR がこのリポジトリに無いため、useLearningPlan.ts と同じ
 * 手書きの useState + useEffect + trigger 形に揃える。
 */
export function useNextCoachingPlan(userId: number | undefined): UseNextCoachingPlan {
  const [items, setItems] = useState<PlanItem[]>([]);
  const [nextSession, setNextSession] = useState<NextSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const reload = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      bffClient.getNextCoachingGoals(userId),
      // 実BFFに存在しない(モック専用)。目標一覧の取得自体を巻き込んで失敗させないよう、
      // 次回セッション情報だけ個別にcatchして「無し」に縮退させる。
      bffClient.getCoachingSessions(userId).catch(() => null),
    ])
      .then(([goals, sessions]) => {
        if (cancelled) return;
        setItems(goals.map(fromApi));
        setNextSession(sessions?.next ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('目標を取得できませんでした');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, trigger]);

  const save = useCallback(
    async (next: PlanItem[]): Promise<boolean> => {
      if (!userId) return false;
      setSaving(true);
      setError(null);
      try {
        const saved = await bffClient.updateNextCoachingGoals(userId, next.map(toApi));
        // サーバの返り値を正にする（no の振り直しがあるため、送った配列では上書きしない）
        setItems(saved.map(fromApi));
        setSaving(false);
        return true;
      } catch {
        setError('目標を保存できませんでした');
        setSaving(false);
        return false;
      }
    },
    [userId]
  );

  return { items, nextSession, loading, saving, error, reload, save };
}
