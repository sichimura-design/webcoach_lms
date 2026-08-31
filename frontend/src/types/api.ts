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

// WebCoach AI
export interface AIRequest {
  message: string;
  user_id?: number;
  course_id?: number;
  context?: Record<string, any>;
  max_chunks?: number;
  use_tools?: boolean;
  image?: string; // 添付画像（data URL）。AIが読み取って回答する。
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
