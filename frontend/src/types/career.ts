/** 案件獲得ダッシュボード（モック専用） */
export interface CareerDashboard {
  weeklyGoal: number;
  appliedThisWeek: number;
  totals: { applied: number; inProgress: number; won: number; rejected: number };
  weekly: { label: string; applied: number }[];
  review: { comment: string; improvements: string[] };
  nextAction: string;
}
