/**
 * Type definitions for MyPage
 * These interfaces are designed for future API integration
 */

import { Profile } from './api';

// 次回コーチングまでの目標 (APIレスポンス)
export interface CoachingGoalApi {
  mdl_user_id: number;
  no: number;
  display_order: number;
  description: string;
  is_completed: 0 | 1;
  progress: number; // 0-100。is_completedはprogress>=100から導出する派生値
  /**
   * 達成した日時（ISO8601）。**モック専用の任意フィールド**。
   * 実BFFの next-coaching-goals はこの項目を返さない（バックエンドは変更禁止）。
   * 値が無い場合を必ず考慮すること。本番では未定義になる。
   */
  completed_at?: string | null;
  /**
   * 所要時間の目安（分）。**モック専用の任意フィールド**。
   * 実BFFの next-coaching-goals はこの項目を返さない（バックエンドは変更禁止）。
   * トップページ 8a のタスク行が「目安 40分」として出すが、値が無ければ行を省く。
   */
  estimated_minutes?: number | null;
}

export interface CoachingGoalUpdateItem {
  no: number;
  description: string;
  is_completed: 0 | 1;
  progress: number;
}

// Career goal (なりたい姿)
export interface CareerGoal {
  goal: string;
}

// Monthly goal (今月の目標)
export interface MonthlyGoal {
  title: string;
  isCompleted: boolean;
}

// Badge progress (バッジ獲得状況)
export interface BadgeProgress {
  earned: number;
  total: number;
  nextRankRemaining: number;
  nextBadge?: Badge;
}

// Course (basic course information)
export interface Course {
  id: number;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  progress?: number;
  roadmapName?: string;
  categoryName?: string;
  categoryColor?: string;
  currentLesson?: string;
  currentChapter?: string;
  remainingMinutes?: number;
  lastAccessDate?: string | Date;
  // 学習サマリー（総学習時間・完了レッスン数）の簡易推定に使う目安値
  durationMinutes?: number;
  totalLessons?: number;
  // おすすめレッスン表示用（バックエンドが返す場合のみ使う任意項目。未設定なら該当バッジを非表示にする）
  difficulty?: string;
  duration?: string;
}

// Current course (受講中のコース)
export interface CurrentCourse {
  id: number;
  title: string;
  roadmap: string;
  currentPhase: string;
  schedule: string;
  progress: number;
  encouragementText: string;
}

// In-progress quest (進行中のクエスト)
export interface InProgressQuest {
  id: number;
  title: string;
  subtitle: string;
  type: string;
  progress: number;
  color: string;
  duration?: string;
}

// Next badge to earn (次に獲得するバッジ)
export interface NextBadge {
  id: number;
  name: string;
  description: string;
  iconColor: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  progress: number; // 0-100
  estimatedCompletion: string; // e.g., "約2週間で達成"
}

// Campaign (キャンペーン)
export interface Campaign {
  id: number;
  title: string;
  backgroundColor: string;
}

// Action item (アクション項目)
export interface ActionItem {
  id: number;
  text: string;
  iconColor: string;
}

// Learning statistics
export interface LearningStats {
  totalCourses: number;
  completedCourses: number;
  inProgressCourses: number;
  totalLearningHours: number;
  streakDays: number;
  certificatesEarned: number;
}

// Course progress information
export interface CourseProgress {
  id: number;
  title: string;
  description: string;
  thumbnailUrl?: string;
  progress: number; // 0-100
  totalActivities: number;
  completedActivities: number;
  lastAccessedAt: string; // ISO date string
  categoryName: string;
  categoryColor?: string;
  estimatedTimeRemaining?: number; // in minutes
  dueDate?: string; // ISO date string
}

// Recent activity
export interface RecentActivity {
  id: number;
  type: 'course_start' | 'activity_complete' | 'quiz_submit' | 'certificate_earned' | 'badge_earned';
  title: string;
  description: string;
  timestamp: string; // ISO date string
  relatedCourseId?: number;
  relatedCourseName?: string;
  iconType?: string;
}

// Upcoming task/deadline
export interface UpcomingTask {
  id: number;
  title: string;
  courseId: number;
  courseName: string;
  dueDate: string; // ISO date string
  type: 'assignment' | 'quiz' | 'activity';
  priority: 'high' | 'medium' | 'low';
  estimatedTime?: number; // in minutes
}

// コミュニティの盛り上がり（ギルドロビー的UI用。取り組んでいる活動別の「直近学習した人数」の集計）
export interface CommunityRoom {
  id: string; // 安定した識別子（表示ラベルは変わりうるのでこちらで検索する）
  activityLabel: string; // 表示用の活動ラベル（例: '実践課題に取り組み中'）
  count: number;
  recentInitials: string[]; // 直近学習した数名のイニシャル（アバター代わり）
}

// 「他の人の様子」用の匿名化された活動フィード（仮名＋匿名アイコン。実名・実写真は使わない）
export interface PseudonymousActivity {
  id: string;
  nickname: string;
  avatarEmoji: string;
  activityLabel: string;
  tag: string;
}

export interface CommunityPulse {
  totalToday: number;
  rooms: CommunityRoom[]; // 自習室（黙々作業）もこの中の1つのroomとして含まれる
  activityFeed: PseudonymousActivity[];
  updatedAt: string; // ISO文字列
}

// 今日のTODO（コーチング目標とは別の、その日単位の小さなタスク）
export interface DailyTodo {
  id: number;
  text: string;
  done: boolean;
}

// 週間の学習ストリーク（曜日ごとの学習有無）
export interface WeekActivity {
  label: string; // '月' '火' ...
  studied: boolean;
}

export interface StreakInfo {
  days: number;
  week: WeekActivity[];
  best?: number; // 自己ベスト連続日数
}

// 学習ジャーニー（ロードマップ＋今日のクエスト）。GET /api/webcoach/journey/:userid
export interface JourneyTodayQuest {
  title: string;
  subtitle: string;
  courseId?: number;
  cta: string;
}

export interface JourneyPhase {
  id: number;
  title: string;
  outcome: string;
  status: 'done' | 'current' | 'locked';
  progress: number;
  recommendedCourseIds: number[];
}

export interface JourneyNode {
  id: number;
  title: string;
  type: 'milestone' | 'lesson' | 'boss';
  status: 'done' | 'current' | 'locked';
  courseId?: number;
  phaseId: number;
}

export interface Journey {
  goal: string;
  streak: { current: number; best: number; last7days: boolean[] };
  todayQuest: JourneyTodayQuest;
  phases: JourneyPhase[];
  nodes: JourneyNode[];
}

// Recommendation
export interface Recommendation {
  id: number;
  type: 'course' | 'skill' | 'pathway';
  title: string;
  description: string;
  thumbnailUrl?: string;
  reason: string; // Why it's recommended
  categoryName?: string;
}

// Quest (gamification element)
export interface Quest {
  id: number;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'special' | 'achievement';
  progress: number; // 0-100
  targetValue: number;
  currentValue: number;
  unit: string; // e.g., "コース", "時間", "アクティビティ"
  reward: string; // e.g., "50 XP", "バッジ: 学習マスター"
  expiresAt?: string; // ISO date string for time-limited quests
  iconName?: string;
  color?: string;
}

// Badge
export interface Badge {
  id: number;
  name: string;
  description: string;
  iconUrl?: string;
  earnedAt?: string; // ISO date string, undefined if not earned yet
  category: 'learning' | 'achievement' | 'special' | 'skill';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  progress?: number; // 0-100, for badges in progress
  requirement?: string; // What's needed to earn this badge
}

// Complete MyPage data structure (what the API should return)
export interface MyPageData {
  user: Profile;
  careerGoal: CareerGoal;
  monthlyGoal: MonthlyGoal;
  badgeProgress: BadgeProgress;
  currentCourse: CurrentCourse;
  inProgressQuests: InProgressQuest[];
  nextBadge: NextBadge;
  campaign: Campaign;
  actionItems: ActionItem[];
  stats?: LearningStats;
  inProgressCourses?: CourseProgress[];
  recentActivities?: RecentActivity[];
  upcomingTasks?: UpcomingTask[];
  recommendations?: Recommendation[];
  activeQuests?: Quest[];
  earnedBadges?: Badge[];
}
