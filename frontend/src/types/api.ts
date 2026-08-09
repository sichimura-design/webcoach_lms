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

// WebCoach CoachingSchedule
export interface CoachingSchedule {
  id: number;
  mdl_user_id: number;
  coach_user_id: number;
  coaching_no: number;
  coaching_date: string;
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
  meeting_url?: string;
  coaching_summary?: string | null;
  todo?: string | null;
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
export interface AIImageAttachment {
  media_type: string;
  data: string; // Base64エンコード済み（data:URIプレフィックスなし）
}

export interface AIRequest {
  message: string;
  user_id?: number;
  course_id?: number;
  context?: Record<string, any>;
  max_chunks?: number;
  use_tools?: boolean;
  image?: AIImageAttachment;
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
