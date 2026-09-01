import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { toLocalDateKey } from '../utils/studyStats';

/**
 * 「前回の続き」カード（components/shared/ResumeStudyHost.tsx）を
 * その日もう出したか。
 *
 * 🔴 日付キーで持つ（YYYY-MM-DD）。永久にオフにはせず、日が変われば自然に戻る。
 *    学習記録の打診が promptDeclinedOn で同じことをしている
 *    （store/studyTimerStore.ts）。そちらと分けているのは、タイマーの状態と
 *    このカードの出し分けが別の寿命で動くため（タイマーは版上げ・migrate がある）。
 */
interface ResumePromptState {
  /** 最後に出した日。null なら一度も出していない */
  shownOn: string | null;
  /** 出した／閉じたときに呼ぶ */
  markShown: () => void;
}

export const useResumePromptStore = create<ResumePromptState>()(
  persist(
    (set) => ({
      shownOn: null,
      markShown: () => set({ shownOn: toLocalDateKey(Date.now()) }),
    }),
    { name: 'webcoach-resume-prompt' }
  )
);

/** その日まだ出していないか */
export function canShowResumePrompt(shownOn: string | null): boolean {
  return shownOn !== toLocalDateKey(Date.now());
}
