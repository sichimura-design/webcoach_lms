import { useNavigate } from 'react-router-dom';
import { useJourney } from './useJourney';
import { RoadmapStep } from '../components/shared';

// マイページの「コーチと決めたロードマップ」表示専用。
// useRoadmapSteps（教材リンク中心のヒント文言）とは見せ方が異なり、
// ここでは月次の計画感を出すため各ステップに月ラベルを添える。
const ROADMAP_STEP_INFO: Record<number, { label: string; month: string }> = {
  2: { label: 'デザインの4大原則', month: '6月' },
  3: { label: '配色の基礎', month: '7月' },
  5: { label: 'バナー制作の基礎', month: '7〜8月' },
  6: { label: 'レイアウト実践', month: '9月' },
  8: { label: 'ポートフォリオ制作', month: '10〜11月' },
  9: { label: '初案件に応募', month: '12月' },
};
const ROADMAP_NODE_IDS = [2, 3, 5, 6, 8];
const GOAL_NODE_ID = 9;

export function useMypageRoadmap(userId: number | undefined) {
  const { journey } = useJourney(userId);
  const navigate = useNavigate();

  const steps: RoadmapStep[] = journey
    ? [
        ...ROADMAP_NODE_IDS.map((id) => {
          const node = journey.nodes.find((n) => n.id === id);
          const status: RoadmapStep['status'] = node?.status === 'done' ? 'done' : node?.status === 'current' ? 'current' : 'todo';
          const info = ROADMAP_STEP_INFO[id];
          return {
            label: info.label,
            status,
            hint: status === 'current' ? `いまここ・${info.month}` : info.month,
            onClick: status === 'todo' ? undefined : () => navigate(node?.courseId ? `/course/${node.courseId}/curriculum` : '/courses'),
          };
        }),
        (() => {
          const goalNode = journey.nodes.find((n) => n.id === GOAL_NODE_ID);
          const status: RoadmapStep['status'] = goalNode?.status === 'done' ? 'done' : goalNode?.status === 'current' ? 'current' : 'todo';
          return {
            label: ROADMAP_STEP_INFO[GOAL_NODE_ID].label,
            status,
            hint: ROADMAP_STEP_INFO[GOAL_NODE_ID].month,
            variant: 'goal' as const,
          };
        })(),
      ]
    : [];

  return { journey, steps };
}
