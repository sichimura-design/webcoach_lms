import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 教材学習ワークスペースのパネル状態。
 *
 * ここで持つのは「どう見せるか」のUI状態だけ。メモ・クリップ・保存したAI回答は
 * モックAPI（mocks/lessonHandlers.ts）側に置く。UI状態は端末ごとの好みなので
 * サーバに送る意味がなく、zustand + persist（progressionStore.ts と同じ作法）で
 * localStorage に保持する。
 */

/** 右パネルの表示モード（要件§5） */
export type SupportMode = 'split' | 'ai' | 'notes';

export const SUPPORT_MODE_LABEL: Record<SupportMode, string> = {
  split: '分割',
  ai: 'AI',
  notes: 'メモ',
};

/** 右パネル幅の可動域（px）。狭すぎるとチャットが読めず、広すぎると教材を圧迫する。 */
export const SUPPORT_WIDTH_MIN = 320;
export const SUPPORT_WIDTH_MAX = 560;

/** AI/メモの上下比率（%）の可動域 */
export const SPLIT_MIN = 34;
export const SPLIT_MAX = 72;

/** 左のコース目次（単元＞レッスン）の幅（固定）。要件でドラッグ対象は右パネルのみ。 */
export const NAV_WIDTH = 300;

export const clampSupportWidth = (v: number) =>
  Math.round(Math.min(SUPPORT_WIDTH_MAX, Math.max(SUPPORT_WIDTH_MIN, v)));

export const clampSplit = (v: number) =>
  Math.round(Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, v)));

interface LearningWorkspaceState {
  /**
   * 左のコース目次を開いているか（PCのみの好み）。
   * SPはオーバーレイになるため、この値ではなく画面側のローカル状態で開閉する
   * （初期表示でドロワーが本文を覆ってしまうため）。
   */
  navOpen: boolean;
  supportOpen: boolean;
  supportWidth: number;
  supportMode: SupportMode;
  splitPercent: number;
  setNavOpen: (open: boolean) => void;
  toggleNav: () => void;
  setSupportOpen: (open: boolean) => void;
  toggleSupport: () => void;
  setSupportWidth: (width: number) => void;
  setSupportMode: (mode: SupportMode) => void;
  setSplitPercent: (percent: number) => void;
  /** 選択文章から「AIに質問」したときのように、開いた上でモードも指定する */
  openSupport: (mode?: SupportMode) => void;
}

export const useLearningWorkspaceStore = create<LearningWorkspaceState>()(
  persist(
    (set, get) => ({
      // 左のコース目次は既定で開く。いま自分がコースのどこ（単元＞レッスン）にいるかが
      // 常に見えている状態を優先する。右のAI・メモは必要なときだけ開く（本文が主役）。
      navOpen: true,
      supportOpen: false,
      supportWidth: 410,
      supportMode: 'split',
      splitPercent: 58,

      setNavOpen: (navOpen) => set({ navOpen }),
      toggleNav: () => set((s) => ({ navOpen: !s.navOpen })),
      setSupportOpen: (supportOpen) => set({ supportOpen }),
      toggleSupport: () => set((s) => ({ supportOpen: !s.supportOpen })),
      setSupportWidth: (width) => set({ supportWidth: clampSupportWidth(width) }),
      setSupportMode: (supportMode) => set({ supportMode }),
      setSplitPercent: (percent) => set({ splitPercent: clampSplit(percent) }),
      openSupport: (mode) => set({ supportOpen: true, supportMode: mode ?? get().supportMode }),
    }),
    {
      name: 'webcoach-learning-workspace',
      // v0（目次が既定で閉じていた頃）の保存値をそのまま復元すると、既存ユーザーだけ
      // 目次が出ないままになる。バージョンを上げて一度だけ既定の「開く」に揃える。
      version: 1,
      migrate: (persisted, version) =>
        version === 0
          ? { ...(persisted as LearningWorkspaceState), navOpen: true }
          : (persisted as LearningWorkspaceState),
    }
  )
);
