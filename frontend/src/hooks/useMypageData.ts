import { Profile } from '../types/api';
import { Course, MonthlyGoal, CareerGoal, StreakInfo } from '../types/mypage';
import {
  fetchUserProfile,
  fetchResumeCourse,
  fetchUserCourses,
  fetchMonthlyGoal,
  fetchCareerGoal,
  fetchStreak,
  fetchRecommendedCourses,
} from '../services/mypageApi';
import { useAsyncData } from './useAsyncData';

interface MypageData {
  userProfile: Profile;
  monthlyGoal: MonthlyGoal;
  careerGoal: CareerGoal;
  resumableCourse: Course | null;
  activeCourses: Course[];
  streak: StreakInfo;
  practiceRecommendations: Course[];
  reviewRecommendations: Course[];
}

export function useMypageData(userId: number | undefined) {
  const { data, loading, error, refetch } = useAsyncData<MypageData | null>(
    () => userId
      ? Promise.all([
          fetchUserProfile(userId),
          fetchMonthlyGoal(userId),
          fetchCareerGoal(userId),
          fetchResumeCourse(userId),
          fetchUserCourses(userId),
          fetchStreak(userId),
          fetchRecommendedCourses(userId),
        ]).then(([userProfile, monthlyGoal, careerGoal, resumableCourse, activeCourses, streak, recommendations]) => ({
          userProfile,
          monthlyGoal,
          careerGoal,
          resumableCourse,
          activeCourses,
          streak,
          practiceRecommendations: recommendations.practiceRecommendations,
          reviewRecommendations: recommendations.reviewRecommendations,
        }))
      : Promise.resolve(null),
    [userId],
  );

  return {
    userProfile: data?.userProfile ?? null,
    monthlyGoal: data?.monthlyGoal ?? null,
    careerGoal: data?.careerGoal ?? null,
    resumableCourse: data?.resumableCourse ?? null,
    activeCourses: data?.activeCourses ?? [],
    streak: data?.streak ?? null,
    practiceRecommendations: data?.practiceRecommendations ?? [],
    reviewRecommendations: data?.reviewRecommendations ?? [],
    loading,
    error,
    refetch,
  };
}
