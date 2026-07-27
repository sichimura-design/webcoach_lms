// レベル/EXPの簡易計算ロジック。凝った曲線にはせず、シンプルな線形式にする（意図的な簡易版）。

export const LEVEL_STEP_EXP = 200;

export interface LevelInfo {
  level: number;
  intoLevel: number;
  toNext: number;
  stepExp: number;
}

export function computeLevel(totalExp: number): LevelInfo {
  const safeExp = Math.max(0, totalExp);
  const level = Math.floor(safeExp / LEVEL_STEP_EXP) + 1;
  const intoLevel = safeExp % LEVEL_STEP_EXP;
  return { level, intoLevel, toNext: LEVEL_STEP_EXP - intoLevel, stepExp: LEVEL_STEP_EXP };
}

// EXP付与ルール（既存のユーザー操作にそのまま紐付ける。新しい経済圏は作らない）
export const EXP_RULES = {
  LESSON_COMPLETE: 10,
  TODO_COMPLETE: 5,
  GOAL_COMPLETE: 20,
  STUDY_SESSION_PER_5MIN: 1,
  STREAK_DAY_BONUS: 15,
  MISSION_ALL_DONE_BONUS: 20,
} as const;
