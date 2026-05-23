/**
 * Mock data for MyPage
 * This simulates the data that will be fetched from the API in the future
 */

import { Profile } from '../types/api';
import {
  MyPageData,
  Course,
  BadgeProgress,
  MonthlyGoal,
  Badge,
  CourseProgress
} from '../types/mypage';

export const mockMyPageData: MyPageData = {
  user: {
    mdl_user_id: 1,
    nick_name: '未来のあなた',
    goal: '売れっ子Webデザイナーになって、場所を選ばず自由に働く！',
  },
  careerGoal: {
    goal: '売れっ子Webデザイナーになって、場所を選ばず自由に働く！',
  },
  monthlyGoal: {
    title: '「Figma基礎講座」を完了させて、バナーをつくりあげる！',
    isCompleted: false,
  },
  badgeProgress: {
    earned: 12,
    total: 50,
    nextRankRemaining: 8,
    nextBadge: {
      id: 1,
      name: '繁忙インフルエンサー',
      description: '週課程時にメッセージを獲得する',
      category: 'achievement',
      rarity: 'rare',
      progress: 65,
      requirement: 'SNS運営コースを完了する',
    },
  },
  currentCourse: {
    id: 1,
    title: 'Web基礎講座',
    roadmap: 'お好きなコースを選び放題',
    currentPhase: 'Phase 3-5「フォーム実装講座（実装）」',
    schedule: '毎週 12時',
    progress: 45,
    encouragementText: 'あと半分！',
  },
  inProgressQuests: [
    {
      id: 1,
      title: 'SNS運営',
      subtitle: 'インスタ運用マスター講座',
      type: 'ロードマップ',
      progress: 35,
      color: '#60A5FA',
    },
    {
      id: 2,
      title: 'AI開発',
      subtitle: '【無料】Midjourney対応術',
      type: '動画教材(16分)',
      progress: 60,
      color: '#9CA3AF',
    },
  ],
  nextBadge: {
    id: 1,
    name: '繁忙インフルエンサー',
    description: '週課程時にメッセージを獲得する',
    iconColor: '#FCD34D',
    rarity: 'rare',
    progress: 65,
    estimatedCompletion: '約2週間で達成',
  },
  campaign: {
    id: 1,
    title: 'AmazonギフトGET!',
    backgroundColor: '#FCA5A5',
  },
  actionItems: [
    {
      id: 1,
      text: 'コーチングのアンケートに回答',
      iconColor: '#34D399',
    },
    {
      id: 2,
      text: '監作提供に応募',
      iconColor: '#A78BFA',
    },
    {
      id: 3,
      text: '転職支援にもうしこむ',
      iconColor: '#60A5FA',
    },
  ],
  stats: {
    totalCourses: 12,
    completedCourses: 5,
    inProgressCourses: 3,
    totalLearningHours: 48.5,
    streakDays: 7,
    certificatesEarned: 3,
  },
  inProgressCourses: [
    {
      id: 1,
      title: 'Web基礎講座',
      description: 'モダンなWebデザインの基礎を学ぶ',
      progress: 45,
      totalActivities: 45,
      completedActivities: 20,
      lastAccessedAt: '2025-11-27T10:30:00Z',
      categoryName: 'デザイン',
      categoryColor: '#F3A7A7',
      estimatedTimeRemaining: 180,
    },
  ],
  recentActivities: [],
  upcomingTasks: [],
  recommendations: [],
  activeQuests: [],
  earnedBadges: [],
};

/**
 * Simulates an API call to fetch MyPage data
 * In the future, replace this with actual API call
 */
export const fetchMyPageData = async (): Promise<MyPageData> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  return mockMyPageData;
};

/**
 * Mock API: ユーザープロフィール取得
 * GET /api/v1/profile/:userid
 */
export const fetchUserProfile = async (userId: number): Promise<Profile> => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return mockMyPageData.user;
};

/**
 * Mock API: 再開可能なコース取得
 * GET /api/v1/resume-course/:userid
 */
export const fetchResumeCourse = async (userId: number): Promise<Course | null> => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    id: 1,
    title: 'Web基礎講座',
    description: 'モダンなWebデザインの基礎を学ぶ',
    progress: 45,
    roadmapName: 'Webデザイナー養成コース',
    categoryName: 'デザイン',
    categoryColor: '#F3A7A7',
  };
};

/**
 * Mock API: ユーザーのロードマップ（進行中のコース）取得
 * GET /api/v1/user-roadmaps/
 */
export const fetchUserRoadmaps = async (userId: number): Promise<Course[]> => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return [
    {
      id: 2,
      title: 'SNS運営',
      description: 'インスタ運用マスター講座',
      progress: 35,
      roadmapName: 'SNSマーケター養成コース',
      categoryName: 'マーケティング',
      categoryColor: '#60A5FA',
    },
    {
      id: 3,
      title: 'AI開発',
      description: '【無料】Midjourney対応術',
      progress: 60,
      categoryName: 'AI・テクノロジー',
      categoryColor: '#9CA3AF',
    },
  ];
};

/**
 * Mock API: バッジ獲得状況取得
 * GET /api/v1/users/:userid/badges/progress
 */
export const fetchBadgeProgress = async (userId: number): Promise<BadgeProgress> => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return mockMyPageData.badgeProgress;
};

/**
 * Mock API: 今月の目標取得
 * GET /api/v1/users/:userid/monthly-goal
 */
export const fetchMonthlyGoal = async (userId: number): Promise<MonthlyGoal> => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    title: '「Figma基礎講座」を完了させて、バナーをつくりあげる！',
    isCompleted: false,
  };
};
