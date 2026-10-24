import type { Course } from '../../types/mypage';
import type { GalleryCourse } from './courseVisuals';
import { usableCourseImage } from '../../utils/courseImage';
import { AREA_NAMES, taxonomyOrderOf } from '../../constants/courseTaxonomy';

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
  // 並びは Moodle の「コースおよびカテゴリ管理」の順（categorysortorder）そのもの。
  // Moodle のコースの sortorder は「カテゴリの sortorder（1万刻み）＋カテゴリ内の順番」で、
  // カテゴリやコースを上下に動かすたびに Moodle が振り直す（fix_course_sortorder）。
  // なのでこの値だけで並べれば、領域の順も領域内の順も管理画面で変えられる（BFF のキャッシュで最大1分遅れる）。
  // Moodle の返す配列そのものは id 順（作成順）なので並べ直す。categorysortorder は
  // core_course_get_courses が moodle/course:update を持つ呼び出し元（bff-service）にだけ返す値。
  // 1件でも無いとき（MSW モック）は「領域の順＝courseTaxonomy → 領域内＝courseTaxonomy の宣言順」、それも無ければ元の順。
  const visible = list.filter((c) => c?.visible !== 0 && c?.visible !== '0');
  const fromMoodle = visible.length > 0 && visible.every((c) => typeof c?.categorysortorder === 'number');
  const areaRank = (c: any) => {
    if (fromMoodle) return 0;
    const i = AREA_NAMES.indexOf(c?.categoryname);
    return i === -1 ? AREA_NAMES.length : i;
  };
  const rankInArea = (c: any, i: number) =>
    fromMoodle ? c.categorysortorder : taxonomyOrderOf(c?.shortname) ?? 100000 + i;
  const ordered = visible
    .map((c, i) => ({ c, area: areaRank(c), r: rankInArea(c, i) }))
    .sort((a, b) => a.area - b.area || a.r - b.r)
    .map(({ c }) => c);
  return ordered.map((c) => {
    const enrolled =
      activeCourses.find((ac) => ac.id === c.id) ??
      (resumableCourse?.id === c.id ? resumableCourse : undefined);
    return toCatalogCourse(c, enrolled ?? undefined, resumableCourse?.id === c.id);
  });
}
