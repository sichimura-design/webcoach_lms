/**
 * 集中ブース（学習セッション記録）関連の型定義
 *
 * 学習時間・ストリーク・カレンダー・ランキング・コースアクセスの集計値は、
 * すべてMoodleのログ(mdl_logstore_standard_log)からapi-server側で計算済みのものを
 * bff-server経由でそのまま受け取る契約にしている。自前テーブルは無く、DB行idの概念も無い。
 */

export type StudySessionMode = 'freeform' | 'pomodoro';

export const STUDY_SESSION_MODE_LABEL: Record<StudySessionMode, string> = {
  freeform: '通常タイマー',
  pomodoro: 'ポモドーロ',
};

/** GET /api/study/sessions/{userid}/recent の1件(started/endedイベントのペアリング結果) */
export interface StudySession {
  courseid: number | null;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
}

/** GET /api/study/sessions/{userid}/active */
export interface ActiveStudySessionInfo {
  courseid: number | null;
  started_at: string;
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

/** GET /api/study/ranking?period=&limit= の1件 */
export interface StudyRankingEntry {
  rank: number;
  userid: number;
  total_minutes: number;
}

/** GET /api/study/ranking?period=&limit= */
export interface StudyRanking {
  period: 'week' | 'month' | 'all';
  entries: StudyRankingEntry[];
}

/** GET /api/study/course-access/{userid} の1件 */
export interface CourseAccessSummary {
  courseid: number;
  access_count: number;
  last_accessed: string;
}

/** GET /api/study/course-access/{userid} */
export interface CourseAccess {
  userid: number;
  courses: CourseAccessSummary[];
}

/** GET /api/study/course-access/{userid}/{courseid}/materials の1件 */
export interface CourseMaterialAccessSummary {
  cmid: number;
  access_count: number;
  last_accessed: string;
}

/** GET /api/study/course-access/{userid}/{courseid}/materials */
export interface CourseMaterialAccess {
  userid: number;
  courseid: number;
  materials: CourseMaterialAccessSummary[];
}

// ---- 実行中のタイマー(クライアント側・localStorage永続化) --------------------
// 一時停止は startedAt を後ろにずらすことで、経過(now - startedAt)の計算をそのまま使えるようにする
// (dev/miyabeのstudyTimerStoreと同じ方式)。sessionIdはサーバーのDB行を指すものではなく、
// クライアント側で発行する一時的な識別子(Date.now()ベース)。一時停止/再開のたびにMoodleへ
// study_session_ended/startedが送信されるため、集計上の一時停止時間の除外はサーバー側で完結する。

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
  courseId?: number;
  courseTitle?: string;
  completedTarget: boolean;
}
