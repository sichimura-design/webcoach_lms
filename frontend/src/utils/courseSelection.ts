/**
 * 集中ブースの「今回学習する教材」の選択肢を組み立てる。純関数のみ。
 *
 * 要件の4分類（現在学習中の教材／前回の続き／最近開いた教材／教材を指定しない）を
 * 3つのデータ源から作る。新しいAPIは要らない。
 *   現在学習中   … fetchUserCourses（進捗が 0 < p < 100 のコース）
 *   前回の続き   … bffClient.getResumeCourses
 *   最近開いた   … store/recentCourseStore（端末ごとの履歴）
 *
 * 🔴 「現在学習中」と「前回の続き」は同じ教材になりやすいので、上位優先で重複排除する。
 *    しないと同じ教材が3回並んで、どれを押せばいいのか分からない一覧になる。
 */
import { Course } from '../types/mypage';
import { ResumeCourse } from '../types/api';
import { RecentCourseEntry } from '../store/recentCourseStore';

export type CourseChoiceGroup = 'resume' | 'current' | 'recent';

export interface CourseChoice {
  group: CourseChoiceGroup;
  courseId: number;
  courseTitle: string;
  lessonId?: number;
  lessonTitle?: string;
  progressPercent?: number;
  /** 一覧に出す補足（「Lesson 4 バナー制作の基礎」など） */
  subtitle?: string;
}

export interface CourseChoiceGroupView {
  group: CourseChoiceGroup;
  label: string;
  items: CourseChoice[];
}

const GROUP_LABEL: Record<CourseChoiceGroup, string> = {
  resume: '前回の続き',
  current: '現在学習中の教材',
  recent: '最近開いた教材',
};

const RECENT_LIMIT = 4;

export interface BuildCourseChoicesInput {
  resumeCourses: ResumeCourse[];
  courses: Course[];
  recent: RecentCourseEntry[];
}

/**
 * グループ順（前回の続き → 現在学習中 → 最近開いた）で重複排除したリストを返す。
 * 「教材を指定しない」はデータではなくUIの選択肢なので、ここには含めない。
 */
export function buildCourseChoices({
  resumeCourses,
  courses,
  recent,
}: BuildCourseChoicesInput): CourseChoiceGroupView[] {
  const seen = new Set<number>();

  const take = (items: CourseChoice[]): CourseChoice[] =>
    items.filter((c) => {
      if (!c.courseId || seen.has(c.courseId)) return false;
      seen.add(c.courseId);
      return true;
    });

  const resume: CourseChoice[] = resumeCourses.slice(0, 2).map((r) => ({
    group: 'resume',
    courseId: r.courseid,
    courseTitle: r.fullname ?? `コース ${r.courseid}`,
    lessonTitle: r.currentlesson,
    progressPercent: r.progress,
    subtitle: r.currentlesson
      ? r.remainingminutes
        ? `${r.currentlesson} ・ 残り約${r.remainingminutes}分`
        : r.currentlesson
      : undefined,
  }));

  // 未着手(0%)と完了(100%)は「現在学習中」ではない
  const current: CourseChoice[] = courses
    .filter((c) => (c.progress ?? 0) > 0 && (c.progress ?? 0) < 100)
    .map((c) => ({
      group: 'current',
      courseId: c.id,
      courseTitle: c.title,
      lessonTitle: c.currentLesson,
      progressPercent: c.progress,
      subtitle: c.currentLesson ?? c.categoryName,
    }));

  const recentChoices: CourseChoice[] = recent.slice(0, RECENT_LIMIT).map((e) => ({
    group: 'recent',
    courseId: e.courseId,
    courseTitle: e.courseTitle,
    lessonId: e.lessonId,
    lessonTitle: e.lessonTitle,
    progressPercent: e.progressPercent,
    subtitle: e.lessonTitle,
  }));

  return (['resume', 'current', 'recent'] as CourseChoiceGroup[])
    .map((group) => ({
      group,
      label: GROUP_LABEL[group],
      items: take(
        group === 'resume' ? resume : group === 'current' ? current : recentChoices
      ),
    }))
    .filter((g) => g.items.length > 0);
}

/** 集中ブースを開いたときの既定選択。前回の続き → 現在学習中 の先頭 */
export function defaultCourseChoice(groups: CourseChoiceGroupView[]): CourseChoice | null {
  return groups[0]?.items[0] ?? null;
}
