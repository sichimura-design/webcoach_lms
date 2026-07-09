/**
 * コーチング（AIミーティングノート）関連の型。
 * 実BFFには存在しない新機能。モックで返す。
 */

export interface CoachingSessionSummary {
  id: number;
  date: string;      // ISO or 表示用
  title: string;
  summary: string;
  tasksCreated: boolean;
}

export interface NextCoaching {
  date: string;      // 表示用日時
  coach: string;
}

export interface CoachingSessions {
  next: NextCoaching | null;
  past: CoachingSessionSummary[];
}

/** AIミーティングノートの生成結果 */
export interface CoachingNote {
  summary: string;
  transcript: string;
  keyPoints: string[];
  suggestedTasks: string[];
}
