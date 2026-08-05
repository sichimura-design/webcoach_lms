import { useEffect, useMemo, useState } from 'react';
import { bffClient } from '../services/bffClient';
import { fetchUserCourses } from '../services/mypageApi';
import { Course } from '../types/mypage';
import { ResumeCourse } from '../types/api';
import { useRecentCourseStore } from '../store/recentCourseStore';
import { CourseChoiceGroupView, buildCourseChoices } from '../utils/courseSelection';

/**
 * 集中ブースの教材選択（現在学習中／前回の続き／最近開いた）。
 * 組み立ては utils/courseSelection.ts の純関数に任せ、ここは取得だけを担う。
 */
export interface UseCourseChoicesResult {
  groups: CourseChoiceGroupView[];
  loading: boolean;
}

export function useCourseChoices(userId: number | undefined): UseCourseChoicesResult {
  const [courses, setCourses] = useState<Course[]>([]);
  const [resumeCourses, setResumeCourses] = useState<ResumeCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const recent = useRecentCourseStore((s) => s.entries);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetchUserCourses(userId).catch(() => [] as Course[]),
      bffClient.getResumeCourses(userId, 5).catch(() => [] as ResumeCourse[]),
    ]).then(([c, r]) => {
      if (cancelled) return;
      setCourses(c);
      setResumeCourses(r);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const groups = useMemo(
    () => buildCourseChoices({ resumeCourses, courses, recent }),
    [resumeCourses, courses, recent]
  );

  return { groups, loading };
}

export default useCourseChoices;
