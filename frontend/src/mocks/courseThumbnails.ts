/**
 * frontend/src/mocks/courseThumbnails.ts
 * コースのサムネイル画像の登録表。
 *
 * import を一切持たない葉モジュールにしてある。コースカタログ（courseCatalog.ts）と
 * 教材API（lessonHandlers.ts）の両方から使うが、lessonHandlers.ts から
 * courseCatalog.ts を import すると循環するため（courseCatalog.ts の
 * import の向きの注意を参照）、共有したい表だけをここへ切り出した。
 * 依存を足さないこと。足した瞬間に循環が復活する。
 */

/**
 * キーは courseTaxonomy の slug、値は frontend/public/images/courses/ 配下のファイル名。
 *
 * 実BFF（Moodle）は courseimage に保護URLを返すが、モックには画像が無いので
 * ここで public の静的ファイルに差し替える。**未登録のコースは画像なし**として
 * 呼び出し側のフォールバック（コース一覧は文字組みサムネ、教材ヘッダーは
 * CourseImage のグラデ）になるので、1枚ずつ足していける。
 *
 * 🔴 リテラルのコースIDをキーにしないこと。ID は領域code*100+連番で採番されるので、
 *    領域内の並びを1つ変えると全部ずれる。slug は動かない。
 */
export const COURSE_THUMBNAILS: Record<string, string> = {
  // 画像が届いたらここに追記する（例: 'design-basics': 'design-basics.png'）
};

/**
 * コースのサムネイルURL。未登録なら undefined（＝画像なし）を返す。
 *
 * サブパス配信（dev プレビューの /branches/<slug>/）でも壊れないよう
 * PUBLIC_URL 起点にする。ここを絶対パスの '/images/...' に戻すとプレビューで 404 になる。
 */
export function courseThumbnailUrl(slug?: string): string | undefined {
  const file = slug ? COURSE_THUMBNAILS[slug] : undefined;
  return file ? `${process.env.PUBLIC_URL}/images/courses/${file}` : undefined;
}
