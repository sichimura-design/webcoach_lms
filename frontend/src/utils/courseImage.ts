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
