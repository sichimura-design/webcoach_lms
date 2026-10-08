import { Profile } from '../types/api';
import { Course, StreakInfo } from '../types/mypage';
import {
  fetchUserProfile,
  fetchResumeCourses,
  fetchUserCourses,
  fetchStreak,
} from '../services/mypageApi';
import { useAsyncData } from './useAsyncData';
import { bffClient } from '../services/bffClient';

// data未確定時のフォールバック用に固定参照を使う。`?? []`をレンダーごとに書くと
// 毎回新しい配列参照になり、これを依存配列に使っている呼び出し元のuseEffectが
// ロード完了まで無限に再実行されてしまう（ネットワーク呼び出しの重複発生）。
const EMPTY_COURSES: Course[] = [];

interface MypageData {
  userProfile: Profile;
  resumableCourse: Course | null;
  activeCourses: Course[];
  streak: StreakInfo;
}

/**
 * 「続きから学習」に使う resumecourse を1件選ぶ。
 * 🔴 resumecourse は削除済み・非表示のコースも返す（名前が引けず「Course 75」になり、開くとエラー）。
 *   1. 受講中（/moodle/courses/{userid}、既に並行で取っている）に居るものを優先する。受講生はコースを
 *      開いた時点で受講登録されるので、ほぼここで決まり、待ち時間は増えない
 *   2. 受講中に居ないとき（admin・coach は受講登録なしで開ける）だけ、コース一覧で実在と visible を確かめる。
 *      一覧は応答が数秒かかるので、1で決まるときは呼ばない
 */
async function pickResumableCourse(candidates: Course[], activeCourses: Course[]): Promise<Course | null> {
  if (candidates.length === 0) return null;
  const enrolled = candidates.find((r) => activeCourses.some((a) => a.id === r.id));
  if (enrolled) return enrolled;
  const catalog = await bffClient.getCourses().catch(() => null);
  if (!Array.isArray(catalog)) return null;
  const alive = new Set(
    catalog.filter((c: any) => c?.visible !== 0 && c?.visible !== '0').map((c: any) => Number(c?.id))
  );
  return candidates.find((r) => alive.has(Number(r.id))) ?? null;
}

export function useMypageData(userId: number | undefined) {
  const { data, loading, error, refetch } = useAsyncData<MypageData | null>(
    () => userId
      ? Promise.all([
          // 以前はここで「今月の目標」「なりたい姿」も取っていたが、中身はどちらも同じプロフィール
          // API で、使う画面も無かった（同じ取得を3回投げていた）ので外した
          fetchUserProfile(userId),
          fetchResumeCourses(userId),
          fetchUserCourses(userId),
          // ストリークはEXPボーナス判定にしか使わない付随データ。ここが失敗しただけで
          // プロフィール等ページ全体まで巻き添えでエラー表示にしないよう個別にcatchする。
          fetchStreak(userId).catch(() => ({ days: 0, week: [] })),
        ]).then(async ([userProfile, resumeCandidates, activeCourses, streak]) => ({
          userProfile,
          resumableCourse: await pickResumableCourse(resumeCandidates, activeCourses),
          activeCourses,
          streak,
        }))
      : Promise.resolve(null),
    [userId],
  );

  return {
    userProfile: data?.userProfile ?? null,
    resumableCourse: data?.resumableCourse ?? null,
    activeCourses: data?.activeCourses ?? EMPTY_COURSES,
    streak: data?.streak ?? null,
    loading,
    error,
    refetch,
  };
}
