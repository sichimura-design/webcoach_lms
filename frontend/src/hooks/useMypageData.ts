import { Profile } from '../types/api';
import { Course, MonthlyGoal, CareerGoal, StreakInfo } from '../types/mypage';
import {
  fetchUserProfile,
  fetchResumeCourses,
  fetchUserCourses,
  fetchMonthlyGoal,
  fetchCareerGoal,
  fetchStreak,
} from '../services/mypageApi';
import { useAsyncData } from './useAsyncData';

// data未確定時のフォールバック用に固定参照を使う。`?? []`をレンダーごとに書くと
// 毎回新しい配列参照になり、これを依存配列に使っている呼び出し元のuseEffectが
// ロード完了まで無限に再実行されてしまう（ネットワーク呼び出しの重複発生）。
const EMPTY_COURSES: Course[] = [];

interface MypageData {
  userProfile: Profile;
  monthlyGoal: MonthlyGoal;
  careerGoal: CareerGoal;
  resumableCourse: Course | null;
  activeCourses: Course[];
  streak: StreakInfo;
}

export function useMypageData(userId: number | undefined) {
  const { data, loading, error, refetch } = useAsyncData<MypageData | null>(
    () => userId
      ? Promise.all([
          fetchUserProfile(userId),
          fetchMonthlyGoal(userId),
          fetchCareerGoal(userId),
          fetchResumeCourses(userId),
          fetchUserCourses(userId),
          // ストリークはEXPボーナス判定にしか使わない付随データ。ここが失敗しただけで
          // プロフィール等ページ全体まで巻き添えでエラー表示にしないよう個別にcatchする。
          fetchStreak(userId).catch(() => ({ days: 0, week: [] })),
        ]).then(([userProfile, monthlyGoal, careerGoal, resumeCandidates, activeCourses, streak]) => ({
          userProfile,
          monthlyGoal,
          careerGoal,
          // 🔴 resumecourse は削除済みコースも返す。受講中（/moodle/courses/{userid}）に居るものの先頭だけ使う。
          //    削除されたコースは受講一覧から消えるので、ここで落ちる（「Course 75」が出ていた不具合）
          resumableCourse: resumeCandidates.find((r) => activeCourses.some((a) => a.id === r.id)) ?? null,
          activeCourses,
          streak,
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
    loading,
    error,
    refetch,
  };
}
