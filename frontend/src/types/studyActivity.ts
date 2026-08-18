/**
 * 集中ブース（学習セッション記録）関連の型定義
 *
 * 集計値(今日/今週/累計・ストリーク・カレンダー)はクライアントで導出せず、
 * すべてapi-server(webcoach_study_activityテーブル)側で計算済みのものを
 * bff-server経由でそのまま受け取る契約にしている。
 */

export type StudySessionMode = 'freeform' | 'pomodoro';

export const STUDY_SESSION_MODE_LABEL: Record<StudySessionMode, string> = {
  freeform: '通常タイマー',
  pomodoro: 'ポモドーロ',
};

/** GET/POST /api/study/sessions/{userid}系のレスポンス形（webcoach_study_activity 1行分） */
export interface StudySession {
  id: number;
  mdl_user_id: number;
  courseid: number | null;
  course_title: string | null;
  status: 'in_progress' | 'completed';
  started_at: string;
  ended_at: string | null;
  local_date: string;
  target_minutes: number | null;
  duration_minutes: number | null;
  measured_seconds: number | null;
  paused_seconds: number;
}

export interface StudySessionStartInput {
  courseid?: number;
  course_title?: string;
  target_minutes?: number;
}

export interface StudySessionFinishInput {
  duration_minutes: number;
  paused_seconds: number;
}

/** GET /api/study/stats/{userid} */
export interface StudyStats {
  userid: number;
  today_minutes: number;
  week_minutes: number;
  total_minutes: number;
}

/** GET /api/study/streak/{userid} */
export interface StudyStreak {
  userid: number;
  current_streak: number;
  last_active_date: string | null;
}

export interface StudyCalendarDay {
  date: string;
  total_minutes: number;
  session_count: number;
}

/** GET /api/study/calendar/{userid}?year=&month= */
export interface StudyCalendarData {
  userid: number;
  year: number;
  month: number;
  days: StudyCalendarDay[];
}

// ---- 実行中のタイマー(クライアント側・localStorage永続化) --------------------
// 一時停止は startedAt を後ろにずらすことで、経過(now - startedAt)の計算をそのまま使えるようにする
// (dev/miyabeのstudyTimerStoreと同じ方式)。sessionIdはapi-server側のwebcoach_study_activity.id。

export interface ActiveStudySession {
  sessionId: number;
  mode: StudySessionMode;
  targetMinutes?: number;
  courseId?: number;
  courseTitle?: string;
  /** epoch ms */
  startedAt: number;
  /** 一時停止した時刻。nullなら稼働中 */
  pausedAt: number | null;
  pausedCount: number;
  pausedTotalMs: number;
  /** ポモドーロ目標到達を検知した時刻。多重通知の防止 */
  targetReachedAt: number | null;
}

/** 終了カードの下書き */
export interface StudyFinishDraft {
  sessionId: number;
  measuredSeconds: number;
  /** ユーザーが修正できる。初期値 = round(measuredSeconds / 60) */
  actualMinutes: number;
  pausedSeconds: number;
  mode: StudySessionMode;
  targetMinutes?: number;
  courseTitle?: string;
  completedTarget: boolean;
}
