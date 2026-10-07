import { courseThumbnailUrl } from '../mocks/courseThumbnails';

/**
 * Moodle のコース画像 URL を、ブラウザの <img> にそのまま渡してよいものだけに絞る。
 *
 * 🔴 pluginfile.php / webservice の URL は使わない。
 *    - 認証が要る（useCourseImage と同じ判断）
 *    - 画像未設定のコースにも Moodle が自動生成の SVG（/course/generated/course.svg）を返し、
 *      しかも dev ではホストが docker 内部名（http://moodle-app:8080）になっていて
 *      ブラウザから読めず、壊れた画像アイコンが出ていた（マイページ「続きから学習」等）
 *    捨てれば呼び出し側は図形／文字組みのサムネに落ちる（courseVisuals.tsx）。
 */
export function usableCourseImage(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (url.includes('/pluginfile.php') || url.includes('/webservice/')) return undefined;
  return url;
}

/**
 * 一覧・マイページで出すコース画像。Moodle の画像が使えなければ、shortname（= courseTaxonomy の slug）で
 * 登録表 COURSE_THUMBNAILS の静的画像（public/images/courses/）に落とす。
 *
 * 🔴 courseThumbnails.ts は mocks/ にあるがモック専用ではない。実BFFでも画像の正本はここで、
 *    これを通さないと本番では全コースが図形サムネになる（Moodle の画像は pluginfile なので上で捨てる）。
 */
export function courseImageOf(
  url: string | undefined | null,
  shortname: string | undefined | null
): string | undefined {
  return usableCourseImage(url) ?? courseThumbnailUrl(shortname ?? undefined);
}
