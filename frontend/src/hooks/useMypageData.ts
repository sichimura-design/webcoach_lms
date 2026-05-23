import { Profile } from '../types/api';
import { Course, MonthlyGoal, CareerGoal } from '../types/mypage';
import {
  fetchUserProfile,
  fetchResumeCourse,
  fetchUserCourses,
  fetchMonthlyGoal,
  fetchCareerGoal,
} from '../services/mypageApi';
import { useAsyncData } from './useAsyncData';

interface MypageData {
  userProfile: Profile;
  monthlyGoal: MonthlyGoal;
  careerGoal: CareerGoal;
  resumableCourse: Course | null;
  activeCourses: Course[];
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
        ]).then(([userProfile, monthlyGoal, careerGoal, resumableCourse, activeCourses]) => ({
          userProfile,
          monthlyGoal,
          careerGoal,
          resumableCourse,
          activeCourses,
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
    loading,
    error,
    refetch,
  };
}
