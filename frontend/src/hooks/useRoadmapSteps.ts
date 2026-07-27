import { useNavigate } from 'react-router-dom';
import { useJourney } from './useJourney';
import { RoadmapStep } from '../components/shared';

// design_handoff_lms_appの「ロードマップ道UI」に合わせた固定ラベル（journey.nodesのidに対応）。
// journey.nodes自体のtitleはコース名ベースなので、表示用にここで短い見出しに揃える。
const ROADMAP_LABELS: Record<number, string> = {
  2: 'デザインの4大原則',
  3: '配色の基礎',
  5: 'バナー制作の基礎',
  6: 'レイアウト実践',
  8: 'ポートフォリオ制作',
};
const ROADMAP_NODE_IDS = [2, 3, 5, 6, 8];

export function useRoadmapSteps(userId: number | undefined) {
  const { journey } = useJourney(userId);
  const navigate = useNavigate();

  const steps: RoadmapStep[] = journey
    ? ROADMAP_NODE_IDS.map((id) => {
        const node = journey.nodes.find((n) => n.id === id);
        const status: RoadmapStep['status'] = node?.status === 'done' ? 'done' : node?.status === 'current' ? 'current' : 'todo';
        return {
          label: ROADMAP_LABELS[id],
          status,
          hint: status === 'done' ? '教材を見る' : status === 'current' ? '▶ 続きから' : '',
          onClick: status === 'todo' ? undefined : () => navigate(node?.courseId ? `/course/${node.courseId}/curriculum` : '/courses'),
        };
      })
    : [];

  return { journey, steps };
}
