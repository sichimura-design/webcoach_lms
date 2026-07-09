/**
 * 学習ジャーニー（ゲーム風ロードマップ＋今日のクエスト＋ストリーク）
 * 実BFFには存在しない新機能。GET /api/webcoach/journey/{userid} をモックで返す。
 */

export type NodeStatus = 'done' | 'current' | 'locked';
export type NodeType = 'lesson' | 'milestone' | 'boss';

/** ロードマップ上の1ステップ（ゲームのマスに相当） */
export interface JourneyNode {
  id: number;
  title: string;
  type: NodeType;
  status: NodeStatus;
  courseId?: number;
  moduleId?: number;
  phaseId: number;
}

/** ゴールまでのフェーズ（章）。到達目標とおすすめ教材を持つ */
export interface JourneyPhase {
  id: number;
  title: string;
  outcome: string; // 到達目標（このフェーズを終えるとどうなるか）
  status: NodeStatus;
  progress: number; // 0-100
  recommendedCourseIds: number[];
}

/** 今日やること（1つに絞る） */
export interface TodayQuest {
  title: string;
  subtitle: string; // 所要時間など
  courseId: number;
  moduleId?: number;
  cta: string;
}

/** 継続日数 */
export interface Streak {
  current: number;
  best: number;
  last7days: boolean[]; // 直近7日の達成有無（左が古い）
}

export interface LearningJourney {
  goal: string; // 最終ゴール（例: Webデザイナーとして初案件を獲得する）
  phases: JourneyPhase[];
  nodes: JourneyNode[];
  todayQuest: TodayQuest;
  streak: Streak;
}
