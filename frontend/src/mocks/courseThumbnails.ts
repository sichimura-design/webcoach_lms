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
  // 原本は assets/thumbnails/<slug>.png。配信用は横800pxのWebPに書き出して置く
  'ai-coding': 'ai-coding.webp',
  'ai-design': 'ai-design.webp',
  'ai-movie': 'ai-movie.webp',
  'ai-sns': 'ai-sns.webp',
  'ai-writing': 'ai-writing.webp',
  'banner-dojo': 'banner-dojo.webp',
  'camera': 'camera.webp',
  'canva': 'canva.webp',
  'capcut': 'capcut.webp',
  'client-work-program': 'client-work-program.webp',
  'design-basics': 'design-basics.webp',
  'devtools': 'devtools.webp',
  'figma': 'figma.webp',
  'genai-basics': 'genai-basics.webp',
  'genai-passport': 'genai-passport.webp',
  'google-ads': 'google-ads.webp',
  'heatmap': 'heatmap.webp',
  'hpb-review': 'hpb-review.webp',
  'html-css': 'html-css.webp',
  'illustrator': 'illustrator.webp',
  'instagram': 'instagram.webp',
  'javascript': 'javascript.webp',
  'job-change': 'job-change.webp',
  'jquery': 'jquery.webp',
  'line-ads': 'line-ads.webp',
  'maria-short-video': 'maria-short-video.webp',
  'marketing-overview': 'marketing-overview.webp',
  'meo': 'meo.webp',
  'meta-ads': 'meta-ads.webp',
  'mindset': 'mindset.webp',
  'photoshop': 'photoshop.webp',
  'practice-ad-video': 'practice-ad-video.webp',
  'practice-business-card': 'practice-business-card.webp',
  'practice-ec-banner': 'practice-ec-banner.webp',
  'practice-logo': 'practice-logo.webp',
  'practice-lp': 'practice-lp.webp',
  'practice-portfolio-movie': 'practice-portfolio-movie.webp',
  'practice-portfolio-site': 'practice-portfolio-site.webp',
  'practice-service-video': 'practice-service-video.webp',
  'practice-short-video': 'practice-short-video.webp',
  'practice-sns-design': 'practice-sns-design.webp',
  'practice-thumbnail': 'practice-thumbnail.webp',
  'premiere-pro': 'premiere-pro.webp',
  'search-console': 'search-console.webp',
  'seo': 'seo.webp',
  'shopify': 'shopify.webp',
  'short-video-creator': 'short-video-creator.webp',
  'sns-buzz': 'sns-buzz.webp',
  'tiktok-ads': 'tiktok-ads.webp',
  'vscode-setup': 'vscode-setup.webp',
  'wix': 'wix.webp',
  'wordpress': 'wordpress.webp',
  'writing': 'writing.webp',
  'x': 'x.webp',
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
