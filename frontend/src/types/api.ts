/**
 * API型定義 - swagger.yamlに基づく
 */

// Error
export interface ApiError {
  error: string;
  detail?: string;
}

export interface UserInfo {
  cognito: {
    sub: string;
    email: string;
    username: string;
  };
  moodle: {
    id: number;
    username: string;
    fullname: string;
    email: string;
    firstname: string;
    lastname: string;
    profileimageurl?: string;
  };
}

// Moodle Course
export interface Course {
  id: number;
  fullname: string;
  shortname: string;
  categoryid: number;
  summary?: string;
  startdate?: number;
  enddate?: number;
  visible?: boolean;
}

export interface CreateCourseRequest {
  fullname: string;
  shortname: string;
  categoryid: number;
  summary?: string;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  parent?: number;
  coursecount?: number;
  categoryimage?: string;
}

export interface CourseModule {
  id: number;
  modname: string;
  name: string;
  description?: string;
  descriptionformat?: number;
  content?: string;
  contentformat?: number;
  timemodified?: number;
}

export interface CourseContent {
  id: number;
  name: string;
  visible?: boolean;
  summary?: string;
  modules?: CourseModule[];
}

export interface CreateActivityRequest {
  modulename: string;
  name: string;
  section?: number;
  intro?: string;
}

// Badges
export interface Badge {
  id: number;
  name: string;
  description?: string;
  imageUrl?: string;
}

export interface UserBadge {
  badgeid: number;
  userid: number;
  dateissued?: number;
  uniquehash?: string;
}

// WebCoach Profile
export interface ProfileUpdate {
  nick_name?: string | null;
  self_intro?: string | null;
  target_job?: string | null;
  ideal_career?: string | null;
  badge_count?: number | null;
  goal?: string | null;
  today_small_step?: string | null;
  avatar_url?: string | null;
  avatar_id?: string | null;
  /**
   * 週間の学習時間目標（分）。トップページ 8a の「今週の目標」で受講生が変更する。
   * 🔴 実BFFの ProfileUpdate はこの項目を受け取らない（バックエンドは変更禁止）。
   *    モックONのときだけ往復し、本番では送っても無視される。
   */
  weekly_target_minutes?: number | null;
}

export interface Profile {
  mdl_user_id: number;
  nick_name?: string | null;
  self_intro?: string | null;
  target_job?: string | null;
  ideal_career?: string | null;
  today_small_step?: string | null;
  badge_count?: number | null;
  goal?: string | null;
  avatar_url?: string | null;
  avatar_id?: string | null;
  weekly_target_minutes?: number | null; // 週間の学習時間目標（デフォルト600分=10時間）
}

// WebCoach ResumeCourse
export interface ResumeCourse {
  courseid: number;
  fullname?: string;
  shortname?: string;
  summary?: string;
  progress?: number;
  lastaccess?: number;
  accesscount?: number;
  image_url?: string;
  courseimage?: string;
  overviewfiles?: { fileurl: string }[];
  // 学習サマリー（総学習時間・完了レッスン数）の簡易推定に使う目安値
  durationminutes?: number;
  totallessons?: number;
  // マイページの「続きから学習」ヒーロー表示用
  currentlesson?: string;
  currentchapter?: string;
  remainingminutes?: number;
}

export interface UpdateResumeCourseRequest {
  courseid: number;
  progress_percent: number;
}

// WebCoach StudyNote
export interface StudyNote {
  content: string;
  updated_at: string | null;
}

export interface UpdateStudyNoteRequest {
  content: string;
}

// WebCoach MyNote（教材に紐づかない自由記述のノート。フォルダは入れ子対応）
export interface MyNoteFolder {
  folder_id: number;
  mdl_user_id: number;
  name: string;
  parent_folder_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMyNoteFolderRequest {
  name: string;
  parent_folder_id?: number | null;
}

export interface UpdateMyNoteFolderRequest {
  name?: string;
  parent_folder_id?: number | null;
}

export interface MyNote {
  noteid: number;
  mdl_user_id: number;
  folder_id: number | null;
  courseid: number | null;
  /** 関連レッスン（MoodleコースモジュールID）。教材画面からの逆引きに使う */
  cmid: number | null;
  /** 重要ラベル（0/1） */
  favorite: number;
  /** AIコーチの回答から作られたか（0/1） */
  from_ai: number;
  /** コーチングから作られたか（0/1） */
  from_coaching: number;
  title: string;
  contents: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMyNoteRequest {
  title: string;
  contents?: string;
  folder_id?: number | null;
  courseid?: number | null;
  cmid?: number | null;
  favorite?: number;
  from_ai?: number;
  from_coaching?: number;
}

export interface UpdateMyNoteRequest {
  title?: string;
  contents?: string;
  folder_id?: number | null;
  courseid?: number | null;
  cmid?: number | null;
  favorite?: number;
  from_ai?: number;
  from_coaching?: number;
}

/** マイノート一覧の絞り込み。folderId=0 はルート直下のみ、cmid はその教材のノートのみ */
export interface MyNoteListQuery {
  folderId?: number;
  cmid?: number;
}

// WebCoach CoachingSchedule
export type CoachingScheduleStatus = 'completed' | 'interrupted' | 'rescheduled';

export interface CoachingSchedule {
  id: number;
  mdl_user_id: number;
  coach_user_id: number;
  coaching_no: number;
  coaching_date: string;
  status: CoachingScheduleStatus | null;
  meeting_url: string;
  coaching_summary: string | null;
  todo: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCoachingScheduleRequest {
  coach_user_id: number;
  coaching_date: string;
  meeting_url: string;
  coaching_summary?: string | null;
  todo?: string | null;
}

export interface UpdateCoachingScheduleRequest {
  coaching_date?: string;
  status?: CoachingScheduleStatus;
  meeting_url?: string;
  coaching_summary?: string | null;
  todo?: string | null;
}

// WebCoach AI Coaching Note
export type CoachingNoteStatus = 'ai_suggested' | 'coach_confirmed' | 'published';

export interface CoachingNote {
  id: number;
  coaching_schedule_id: number;
  status: CoachingNoteStatus;
  session_summary: string | null;
  client_status_and_goal: string | null;
  main_issues: string | null;
  coach_feedback: string | null;
  decisions: string | null;
  client_next_actions: string | null;
  coach_follow_up: string | null;
  next_session_check: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateCoachingNoteRequest {
  status?: CoachingNoteStatus;
  session_summary?: string | null;
  client_status_and_goal?: string | null;
  main_issues?: string | null;
  coach_feedback?: string | null;
  decisions?: string | null;
  client_next_actions?: string | null;
  coach_follow_up?: string | null;
  next_session_check?: string | null;
}

// WebCoach Roadmap
export interface Roadmap {
  id: number;
  title?: string;
  category?: string;
  difficulty?: string;
  description?: string;
}

export interface RoadmapQueryParams {
  category?: string;
  difficulty?: string;
  limit?: number;
  offset?: number;
}

// WebCoach Career Roadmap（フェーズ制・スキル別テンプレート）
export interface RoadmapSkill {
  id: number;
  code: string;
  name: string;
  goal_label: string | null;
  display_order: number;
}

export interface RoadmapTodo {
  phase_id: number;
  todo_no: number;
  description: string;
}

export interface RoadmapPhase {
  id: number;
  skill_id: number;
  phase_no: number;
  name: string;
  goal: string;
  milestone: string;
  duration_days: number | null;
  todos: RoadmapTodo[];
}

export interface RoadmapProgress {
  id: number;
  user_roadmap_id: number;
  phase_id: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'skipped';
  start: string | null;
  end: string | null;
  updated_by: number | null;
  phase: RoadmapPhase;
}

export interface UserRoadmap {
  id: number;
  mdl_user_id: number;
  skill_id: number;
  is_completed: boolean;
  skill: RoadmapSkill;
  target_date: string | null;
  phases: RoadmapProgress[];
}

export interface RoadmapProgressUpdate {
  status?: 'not_started' | 'in_progress' | 'completed' | 'skipped';
  start?: string;
  end?: string;
}

export interface RoadmapQuestion {
  review_no: number;
  question_no: number;
  question: string;
}

export interface RoadmapAnswer {
  mdl_user_id: number;
  review_no: number;
  question_no: number;
  answer: string;
  created_at: string;
}

// WebCoach AI
export interface AIImageAttachment {
  media_type: string;
  data: string; // Base64エンコード済み（data:URIプレフィックスなし）
}

export interface AIConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  message: string;
  user_id?: number;
  course_id?: number;
  context?: Record<string, any>;
  max_chunks?: number;
  use_tools?: boolean;
  image?: AIImageAttachment;
  conversation_history?: AIConversationMessage[];
}

export interface AISource {
  chunk_index?: number;
  module_name?: string;
  filename?: string;
  section_name?: string;
  similarity?: number;
}

export interface AIToolCall {
  tool_name?: string;
  success?: boolean;
  result?: Record<string, any>;
  error?: string;
}

export interface AIResponse {
  success: boolean;
  message?: string;
  sources?: AISource[];
  tool_calls?: AIToolCall[];
  context?: Record<string, any>;
  timestamp?: string;
  suggestions?: string[];
}

// WebCoach Database
export interface UpdateDBRequest {
  data_type: string;
  records: Record<string, any>[];
}

export interface UpdateDBResponse {
  success: boolean;
  recordsProcessed: number;
  recordsFailed: number;
  message: string;
  errors?: Array<{ row: number; message: string }>;
}

// Health
export interface HealthResponse {
  status: string;
  timestamp?: string;
  service?: string;
  environment?: string;
}
