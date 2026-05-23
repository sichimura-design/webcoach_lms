/**
 * MyPage API Service
 * BFFサーバー経由でMyPageに必要なデータを取得
 */

import { bffClient } from './bffClient';
import { Profile } from '../types/api';
import {
  Course,
  BadgeProgress,
  MonthlyGoal,
  CareerGoal,
} from '../types/mypage';

// アバター一覧のモジュールレベルキャッシュ（セッション中は保持）
let cachedAvatars: Array<{ avatar_id: number; url: string }> | null = null;

async function resolveAvatarUrlById(avatarId: string): Promise<string | null> {
  if (!cachedAvatars) {
    cachedAvatars = await bffClient.getAvatars().catch(() => []);
  }
  const found = cachedAvatars.find(a => a.avatar_id === Number(avatarId));
  return found?.url ?? null;
}

/**
 * ユーザープロフィール取得
 * avatar_id が数値IDの場合、アバターテーブルから URL を解決して avatar_url に補完する
 */
export const fetchUserProfile = async (userId: number): Promise<Profile> => {
  const profile = await bffClient.getUserProfile(userId);

  if (profile.avatar_id && /^\d+$/.test(profile.avatar_id) && !profile.avatar_url) {
    const url = await resolveAvatarUrlById(profile.avatar_id);
    if (url) profile.avatar_url = url;
  }

  return profile;
};

/**
 * 再開可能なコース取得
 */
export const fetchResumeCourse = async (userId: number): Promise<Course | null> => {
  const response = await bffClient.getResumeCourses(userId, 1);

  if (Array.isArray(response) && response.length > 0) {
    const course = response[0];
    return {
      id: course.courseid,
      title: course.fullname || '',
      description: course.summary || '',
      progress: course.progress || 0,
      thumbnailUrl: course.image_url,
      roadmapName: 'ロードマップ',
      categoryName: 'カテゴリ',
      categoryColor: '#F3A7A7',
      currentLesson: undefined,
      lastAccessDate: course.lastaccess ? new Date(course.lastaccess * 1000).toISOString() : undefined,
    };
  }

  return null;
};

/**
 * ユーザーのロードマップ（進行中のコース）取得
 * @deprecated fetchUserCoursesを使用してください
 */
export const fetchUserRoadmaps = async (userId: number): Promise<Course[]> => {
  const response = await bffClient.getResumeCourses(userId, 10);

  if (Array.isArray(response)) {
    return response.map((course) => ({
      id: course.courseid,
      title: course.fullname || '',
      description: course.summary || '',
      progress: course.progress || 0,
      roadmapName: 'ロードマップ',
      categoryName: 'カテゴリ',
      categoryColor: '#60A5FA',
    }));
  }

  return [];
};

/**
 * ユーザーの受講コース取得
 * GET /api/moodle/courses/{userid}
 */
export const fetchUserCourses = async (userId: number): Promise<Course[]> => {
  console.log('fetchUserCourses called with userId:', userId);
  const response = await bffClient.getUserCourses(userId);
  console.log('fetchUserCourses response:', response);

  if (Array.isArray(response)) {
    const courses = response.map((course) => ({
      id: course.id || course.courseid,
      title: course.fullname || course.displayname || '',
      description: course.summary || '',
      progress: course.progress || 0,
      thumbnailUrl: course.courseimage || course.overviewfiles?.[0]?.fileurl,
      categoryName: course.categoryname || 'カテゴリ',
      categoryColor: '#60A5FA',
      lastAccessDate: course.lastaccess ? new Date(course.lastaccess * 1000).toISOString() : undefined,
    }));
    console.log('fetchUserCourses mapped courses:', courses);
    return courses;
  }

  return [];
};

/**
 * バッジ獲得状況取得
 */
export const fetchBadgeProgress = async (userId: number): Promise<BadgeProgress> => {
  // プロフィールとおすすめバッジを並列取得
  const [profile, recommendedBadges] = await Promise.all([
    bffClient.getUserProfile(userId),
    bffClient.getRecommendedBadges(userId),
  ]);

  // レスポンス（Badge[]）からバッジ情報を抽出
  const badges = Array.isArray(recommendedBadges) ? recommendedBadges : [];
  const nextBadge = badges.length > 0 ? badges[0] : null;

  return {
    earned: profile.badge_count || 0,
    total: badges.length || 50,
    nextRankRemaining: 10,
    nextBadge: nextBadge ? {
      id: nextBadge.id,
      name: nextBadge.name,
      description: nextBadge.description || '',
      category: 'achievement',
      rarity: 'common',
      progress: 0,
      requirement: '',
    } : undefined,
  };
};

/**
 * 今月の目標取得
 */
export const fetchMonthlyGoal = async (userId: number): Promise<MonthlyGoal> => {
  const response = await bffClient.getUserProfile(userId);

  // Profile型からtoday_small_stepを使用
  if (response.today_small_step) {
    return {
      title: response.today_small_step,
      isCompleted: false,
    };
  }

  // デフォルトの目標
  return {
    title: '今月の目標を設定しましょう！',
    isCompleted: false,
  };
};

/**
 * キャリアゴール（なりたい姿）取得
 * target_job と ideal_work_style を組み合わせる
 */
export const fetchCareerGoal = async (userId: number): Promise<CareerGoal> => {
  const response = await bffClient.getUserProfile(userId);

  return {
    goal: response.goal || '目標を設定しましょう'
  };
};
