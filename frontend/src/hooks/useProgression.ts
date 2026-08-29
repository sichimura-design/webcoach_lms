import { useProgressionStore } from '../store/progressionStore';
import { computeLevel } from '../utils/progression';

export function useProgression() {
  const totalExp = useProgressionStore((s) => s.totalExp);
  return { totalExp, ...computeLevel(totalExp) };
}
