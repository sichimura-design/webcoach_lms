import type { Course } from '../../types/mypage';
import type { GalleryCourse } from './courseVisuals';

/**
 * BFF の生コース（/moodle/courses）を一覧タイルの表現に直す。
 *
 * 学習トップ（MaterialsTopPage）と領域ページ（AreaCoursesPage）の両方が同じ
 * カタログを描くので、変換を1か所に置く。片方だけ直すと、同じコースが
 * 画面によって別の見た目・別の件数になる（8512973 でモックデータを
 * courseCatalog.ts に1本化したのと同じ理由）。
 */
export interface CatalogCourse extends GalleryCourse {
  /** 種類の判定材料。実BFFで来ないときは courseKindOf がコース名から拾う */
  tags?: { rawname: string }[];
}

export function toCatalogCourse(
  raw: any,
  enrolled: Course | undefined,
  isCurrent: boolean
): CatalogCourse {
  return {
    id: raw.id,
    title: raw.fullname || raw.displayname || '',
    description: raw.summary || '',
    // 領域が来ないときは空にする。「学習領域」という文字を入れると、
    // それがカテゴリ名としてタイルに印字されてしまう
    categoryName: raw.categoryname || '',
    totalLessons: raw.lessoncount ?? enrolled?.totalLessons,
    duration: raw.duration,
    purposes: Array.isArray(raw.purposes) ? raw.purposes : undefined,
    tags: Array.isArray(raw.tags) ? raw.tags : undefined,
    thumbnailUrl: raw.courseimage,
    progress: enrolled?.progress ?? 0,
    isCurrent,
  };
}

/** 全コースを取り、受講中の進捗をマージする。呼び出し側で catch する */
export function buildCatalog(
  raw: unknown,
  activeCourses: Course[],
  resumableCourse: Course | null | undefined
): CatalogCourse[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((c) => {
    const enrolled =
      activeCourses.find((ac) => ac.id === c.id) ??
      (resumableCourse?.id === c.id ? resumableCourse : undefined);
    return toCatalogCourse(c, enrolled ?? undefined, resumableCourse?.id === c.id);
  });
}
