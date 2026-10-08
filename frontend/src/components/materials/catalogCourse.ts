import type { Course } from '../../types/mypage';
import type { GalleryCourse } from './courseVisuals';
import { usableCourseImage } from '../../utils/courseImage';
import { taxonomyOrderOf } from '../../constants/courseTaxonomy';

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
    thumbnailUrl: usableCourseImage(raw.courseimage),
    progress: enrolled?.progress ?? 0,
    isCurrent,
    enrolled: !!enrolled,
  };
}

/** 全コースを取り、受講中の進捗をマージする。呼び出し側で catch する */
export function buildCatalog(
  raw: unknown,
  activeCourses: Course[],
  resumableCourse: Course | null | undefined
): CatalogCourse[] {
  const list = Array.isArray(raw) ? raw : [];
  // BFF は管理者トークンで Moodle を引くので、非表示（visible=0）のコースも返ってくる。
  // 受講生の一覧には出さない（Moodle の「コースの可視性」を効かせる）。
  // 並びは courseTaxonomy の宣言順（領域内のカリキュラム順）。正典に無いコースは元の順のまま後ろへ。
  // Moodle の返す順（作成順）のままだと、あとから足したコースが領域の末尾に来る。
  const visible = list.filter((c) => c?.visible !== 0 && c?.visible !== '0');
  const rank = (c: any, i: number) => taxonomyOrderOf(c?.shortname) ?? 100000 + i;
  const ordered = visible
    .map((c, i) => ({ c, r: rank(c, i) }))
    .sort((a, b) => a.r - b.r)
    .map(({ c }) => c);
  return ordered.map((c) => {
    const enrolled =
      activeCourses.find((ac) => ac.id === c.id) ??
      (resumableCourse?.id === c.id ? resumableCourse : undefined);
    return toCatalogCourse(c, enrolled ?? undefined, resumableCourse?.id === c.id);
  });
}
