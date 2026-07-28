import { useNavigate } from 'react-router-dom';
import { useJourney } from './useJourney';

export interface HomeRoadmapStep {
  label: string;
  status: 'done' | 'current' | 'todo';
  onClick?: () => void;
}

// フロントデザイン/WebCoach Home.dc.html の6ステップロードマップに合わせた固定ラベル
// （journey.nodesのidに対応。idそのものは既存データを流用し、表示名だけ新デザインに揃える）
const NODE_LABELS: Record<number, string> = {
  1: '環境設定',
  2: 'デザインの基礎',
  5: 'バナー制作の基礎',
  6: 'コーディング基礎',
  7: 'レスポンシブ対応',
  8: 'ポートフォリオ制作',
};
const NODE_IDS = [1, 2, 5, 6, 7, 8];

export function useHomeRoadmap(userId: number | undefined) {
  const { journey } = useJourney(userId);
  const navigate = useNavigate();

  const steps: HomeRoadmapStep[] = journey
    ? NODE_IDS.map((id) => {
        const node = journey.nodes.find((n) => n.id === id);
        const status: HomeRoadmapStep['status'] = node?.status === 'done' ? 'done' : node?.status === 'current' ? 'current' : 'todo';
        return {
          label: NODE_LABELS[id],
          status,
          onClick: status === 'todo' ? undefined : () => navigate(node?.courseId ? `/course/${node.courseId}/curriculum` : '/courses'),
        };
      })
    : [];

  const currentIndex = steps.findIndex((s) => s.status === 'current');
  const doneCount = steps.filter((s) => s.status === 'done').length;
  const progressFraction = steps.length > 1 ? doneCount / (steps.length - 1) : 0;

  return { journey, steps, currentIndex, doneCount, progressFraction };
}
