import { Profile } from '../types/api';
import { Course, MonthlyGoal, CareerGoal, StreakInfo } from '../types/mypage';
import {
  fetchUserProfile,
  fetchResumeCourse,
  fetchUserCourses,
  fetchMonthlyGoal,
  fetchCareerGoal,
  fetchStreak,
  fetchNextCourses,
} from '../services/mypageApi';
import type { NextRecommendation } from '../utils/nextCourseRecommend';
import { useAsyncData } from './useAsyncData';

// data未確定時のフォールバック用に固定参照を使う。`?? []`をレンダーごとに書くと
// 毎回新しい配列参照になり、これを依存配列に使っている呼び出し元のuseEffectが
// ロード完了まで無限に再実行されてしまう（ネットワーク呼び出しの重複発生）。
const EMPTY_COURSES: Course[] = [];
const EMPTY_RECOMMENDATIONS: NextRecommendation<Course>[] = [];

interface MypageData {
  userProfile: Profile;
  monthlyGoal: MonthlyGoal;
  careerGoal: CareerGoal;
  resumableCourse: Course | null;
  activeCourses: Course[];
  streak: StreakInfo;
  nextRecommendations: NextRecommendation<Course>[];
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
          // 「次におすすめ」はモック専用APIで、本番(モックOFF)では501になる。
          // ここで握りつぶさないとPromise.all全体が落ち、マイページごと表示できなくなる。
          fetchNextCourses(userId).catch(() => EMPTY_RECOMMENDATIONS),
        ]).then(([userProfile, monthlyGoal, careerGoal, resumableCourse, activeCourses, streak, nextRecommendations]) => ({
          userProfile,
          monthlyGoal,
          careerGoal,
          resumableCourse,
          activeCourses,
          streak,
          nextRecommendations,
        }))
      : Promise.resolve(null),
    [userId],
  );

  return {
    userProfile: data?.userProfile ?? null,
    monthlyGoal: data?.monthlyGoal ?? null,
    careerGoal: data?.careerGoal ?? null,
    resumableCourse: data?.resumableCourse ?? null,
    activeCourses: data?.activeCourses ?? EMPTY_COURSES,
    streak: data?.streak ?? null,
    nextRecommendations: data?.nextRecommendations ?? EMPTY_RECOMMENDATIONS,
    loading,
    error,
    refetch,
  };
}
