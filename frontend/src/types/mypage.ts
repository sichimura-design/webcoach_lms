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
}

export interface CoachingGoalUpdateItem {
  no: number;
  description: string;
  is_completed: 0 | 1;
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
  lastAccessDate?: string | Date;
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
