/**
 * 学習計画（月間＞週間）。実BFFには存在しない新機能。モックで返す。
 */
export interface StudySession {
  title: string;
  minutes: number;
  courseId?: number;
  done: boolean;
}

export interface StudyDay {
  date: string;      // YYYY-MM-DD
  weekday: string;   // 月〜日
  md: string;        // 表示用 M/D
  sessions: StudySession[];
}

/** 前週の進捗をDBから取得したうえでのAI振り返り */
export interface StudyReview {
  lastWeekLabel: string;
  planned: number;
  completed: number;
  streak: number;
  comment: string;
  improvements: string[];
}

export interface StudyPlan {
  weekLabel: string;   // 例: 7/13–7/19
  days: StudyDay[];
  hasPlan: boolean;
  review?: StudyReview | null;
}
