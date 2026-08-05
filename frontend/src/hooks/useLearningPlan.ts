/**
 * frontend/src/hooks/useLearningPlan.ts
 * 学習ロードマップの読み取り。マイページのカードと /learning-plan の両方が使う。
 *
 * このリポジトリには react-query / SWR が入っていないため、
 * useNextCoachingPlan.ts と同じ手書きの useState + useEffect 形に揃える。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { bffClient } from '../services/bffClient';
import {
  CheckinPrompt,
  LearningPlan,
  Milestone,
  PhaseProgressStatus,
  PlanPhase,
  PlanRevision,
  PlanStage,
} from '../types/learningPlan';
import {
  currentMonthMilestones,
  currentPhaseIndex,
  derivePhaseStatus,
  deriveStages,
  planProgress,
} from '../utils/learningPlanTemplate';

export interface UseLearningPlanResult {
  plan: LearningPlan | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** 呼び出し側で編集結果を即反映させたいとき用（保存後の再取得を省ける） */
  setPlan: (plan: LearningPlan) => void;

  currentPhase: PlanPhase | null;
  currentIndex: number;
  /** plan.phases と同じ並び */
  phaseStatuses: PhaseProgressStatus[];
  monthMilestones: Milestone[];

  /** 7フェーズを表示用に束ねた4ステージ。中身が空のステージは含まない。 */
  stages: PlanStage[];
  /** 現在ステージ。plan が無ければ null */
  currentStage: PlanStage | null;
  /** ロードマップ全体の進捗 0-1 */
  progress: number;

  revisions: PlanRevision[];
  /** 最新の未確認の更新案。無ければ null */
  pendingRevision: PlanRevision | null;
  /** 未操作のまま溜まっている更新候補の件数 */
  pendingRevisionCount: number;

  checkin: CheckinPrompt | null;
  /** 見直し日が近く、まだ回答していない */
  checkinDue: boolean;
}

export function useLearningPlan(userId: number | undefined): UseLearningPlanResult {
  const [plan, setPlan] = useState<LearningPlan | null>(null);
  const [revisions, setRevisions] = useState<PlanRevision[]>([]);
  const [checkin, setCheckin] = useState<CheckinPrompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const reload = useCallback(() => setTrigger((t) => t + 1), []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      bffClient.getLearningPlan(userId),
      bffClient.getPlanRevisions(userId),
      bffClient.getPlanCheckin(userId),
    ])
      .then(([p, r, c]) => {
        if (cancelled) return;
        setPlan(p);
        setRevisions(r);
        setCheckin(c);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('学習ロードマップの取得に失敗しました');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, trigger]);

  // 日付から導出する値。today は「その日のうちは同じ結果」で十分なので日付文字列を依存にする。
  const today = useMemo(() => new Date(), []);

  const currentIndex = useMemo(() => (plan ? currentPhaseIndex(plan, today) : -1), [plan, today]);
  const phaseStatuses = useMemo(() => (plan ? derivePhaseStatus(plan, today) : []), [plan, today]);
  const monthMilestones = useMemo(() => (plan ? currentMonthMilestones(plan, today) : []), [plan, today]);
  const stages = useMemo(() => (plan ? deriveStages(plan, today) : []), [plan, today]);
  const progress = useMemo(() => (plan ? planProgress(plan, today) : 0), [plan, today]);

  const pending = useMemo(() => revisions.filter((r) => r.status === 'pending'), [revisions]);

  return {
    plan,
    loading,
    error,
    reload,
    setPlan,
    currentPhase: plan && currentIndex >= 0 ? plan.phases[currentIndex] ?? null : null,
    currentIndex,
    phaseStatuses,
    monthMilestones,
    stages,
    currentStage: stages.find((s) => s.status === 'current') ?? null,
    progress,
    revisions,
    pendingRevision: pending[0] ?? null,
    pendingRevisionCount: pending.length,
    checkin,
    checkinDue: checkin?.due === true,
  };
}
