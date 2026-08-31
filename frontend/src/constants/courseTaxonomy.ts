/**
 * frontend/src/constants/courseTaxonomy.ts
 * 学習領域とコースの「中身」を集約する。呼び方は learningTaxonomy.ts、
 * 実際に何があるかはこちら。
 *
 * 教材の構成は「学習領域 ＞ コース」の2段で確定した。ここがその写しで、
 * 領域の表示順・コースのカリキュラム順・コースIDのすべてがこの1つの表から出る。
 *
 * 重要: 「区分（基礎 / 応用 / 発展）」は退役した。
 * 3段のどこに置くかを人が手で決めていたため、受講生に「基礎と応用は何が違うのか」を
 * 説明できず、絞り込みとして分かりづらいという指摘が出た。
 * 代わりの軸は「種類（基礎コース / 実践課題）」で、これはコース名の
 * 「実践課題：〜」というプレフィックスから機械的に決まる（courseKindOf）。
 * 人が値を振らないので、増えたコースが未分類のまま取り残されることが無い。
 *
 * コースIDは `領域code * 100 + 領域内の順番`（1始まり）。
 *   - 先頭桁が family（1=仕事の土台 / 2=作る / 3=集める / 4=案件 / 5=AI）なので
 *     URLやCSVでIDを見ただけでどの辺の教材か分かる
 *   - 領域code は手書きなので、領域を足しても既存コースのIDが動かない
 * IDをリテラルで書かないこと。フィクスチャからは COURSE_ID_BY_SLUG / courseIdOf を通す。
 */

/**
 * 領域の色・サムネ図形のまとまり。10領域に10色を割ると情報を持たない虹になるので、
 * 「何をしているか」で5つに畳む（aiSkillRecommend.ts の分け方と同じ考え方）。
 */
export type AreaFamily = 'career' | 'create' | 'build' | 'grow' | 'ai';

export interface AreaDef {
  name: string;
  /** IDの上2桁。手書きで固定する */
  code: number;
  family: AreaFamily;
  /** 領域の説明。/moodle/categories の description に出す */
  description: string;
}

export interface CourseDef {
  name: string;
  /** shortname 兼 参照キー。英小文字とハイフンだけ */
  slug: string;
}

/** 領域とコース。この配列の順序がそのまま表示順・カリキュラム順になる */
export const AREA_COURSES: ReadonlyArray<AreaDef & { courses: readonly CourseDef[] }> = [
  {
    name: 'ソフトスキル',
    code: 11,
    family: 'career',
    description: '学ぶ前に知っておきたい心得とマインドセット',
    courses: [
      { name: '学習に必要な心得集', slug: 'mindset' },
    ],
  },
  {
    name: 'キャリア',
    code: 12,
    family: 'career',
    description: 'リサーチ・自己分析から選考対策まで',
    courses: [
      { name: '転職', slug: 'job-change' },
    ],
  },
  {
    name: 'Webデザイン',
    code: 21,
    family: 'create',
    description: 'デザインの基礎概念からツール、実践課題まで',
    courses: [
      { name: 'デザイン基礎', slug: 'design-basics' },
      { name: 'Figma', slug: 'figma' },
      { name: 'Canva', slug: 'canva' },
      { name: 'ライティング', slug: 'writing' },
      { name: 'イラストレーター', slug: 'illustrator' },
      { name: 'フォトショップ', slug: 'photoshop' },
      { name: 'バナー100本道場', slug: 'banner-dojo' },
      { name: '実践課題：ロゴデザイン', slug: 'practice-logo' },
      { name: '実践課題：名刺作成', slug: 'practice-business-card' },
      { name: '実践課題：SNSデザイン', slug: 'practice-sns-design' },
      { name: '実践課題：ECバナー・パッケージ', slug: 'practice-ec-banner' },
      { name: '実践課題：LP制作', slug: 'practice-lp' },
      { name: '実践課題：ポートフォリオサイト制作', slug: 'practice-portfolio-site' },
    ],
  },
  {
    name: 'Web制作',
    code: 22,
    family: 'build',
    description: 'ノーコードからコーディングまで、作って公開する',
    courses: [
      { name: 'Wix', slug: 'wix' },
      { name: 'WordPress', slug: 'wordpress' },
      { name: 'VSCode環境セットアップ', slug: 'vscode-setup' },
      { name: 'HTML/CSS', slug: 'html-css' },
      { name: 'JavaScript', slug: 'javascript' },
      { name: 'jQuery', slug: 'jquery' },
      { name: 'Shopify', slug: 'shopify' },
      { name: 'デベロッパーツール', slug: 'devtools' },
    ],
  },
  {
    name: '動画編集',
    code: 23,
    family: 'create',
    description: '編集ツールの操作と、納品できる動画の作り方',
    courses: [
      { name: 'CapCut', slug: 'capcut' },
      { name: 'Premiere Pro', slug: 'premiere-pro' },
      { name: '実践課題：サムネイル制作入門', slug: 'practice-thumbnail' },
      { name: '実践課題：ショート動画制作', slug: 'practice-short-video' },
      { name: '実践課題：Web広告動画制作', slug: 'practice-ad-video' },
      { name: '実践課題：サービス紹介動画制作', slug: 'practice-service-video' },
      { name: '実践課題：ポートフォリオムービー制作', slug: 'practice-portfolio-movie' },
    ],
  },
  {
    name: 'Webマーケティング',
    code: 31,
    family: 'grow',
    description: '解析・SEO・広告運用で数字を動かす',
    courses: [
      { name: 'マーケティング概論', slug: 'marketing-overview' },
      { name: 'Google Analytics', slug: 'google-analytics' },
      { name: 'Google Search Console', slug: 'search-console' },
      { name: 'ヒートマップ', slug: 'heatmap' },
      { name: 'SEO', slug: 'seo' },
      { name: 'Meta広告運用', slug: 'meta-ads' },
      { name: 'Google広告運用', slug: 'google-ads' },
      { name: 'TikTok広告運用', slug: 'tiktok-ads' },
      { name: 'LINE広告運用', slug: 'line-ads' },
      { name: 'MEO運用', slug: 'meo' },
      { name: 'HPB添削', slug: 'hpb-review' },
    ],
  },
  {
    name: 'SNS運用',
    code: 32,
    family: 'grow',
    description: '各SNSの運用と、伸びる企画の作り方',
    courses: [
      { name: 'インスタグラム運用', slug: 'instagram' },
      { name: 'X運用', slug: 'x' },
      { name: 'ショート動画クリエイター育成カリキュラム', slug: 'short-video-creator' },
      { name: 'インフルエンサーMaria流・人を惹きつけるショート動画企画術', slug: 'maria-short-video' },
      { name: 'SNSバズ', slug: 'sns-buzz' },
      { name: '実機カメラ', slug: 'camera' },
    ],
  },
  {
    name: '案件獲得攻略プログラム',
    code: 41,
    family: 'career',
    description: '最初の1件から継続案件までの進め方',
    courses: [
      { name: '案件獲得攻略プログラム', slug: 'client-work-program' },
    ],
  },
  {
    name: '生成AI基礎',
    code: 51,
    family: 'ai',
    description: 'AIの市場感・著作権など前提の理解',
    courses: [
      { name: '生成AI基礎', slug: 'genai-basics' },
      { name: '生成AIパスポート認定講座', slug: 'genai-passport' },
    ],
  },
  {
    name: 'Web×AI',
    code: 52,
    family: 'ai',
    description: '実務のそれぞれの工程にAIを組み込む',
    courses: [
      { name: 'AI×デザイン', slug: 'ai-design' },
      { name: 'AI×コーディング', slug: 'ai-coding' },
      { name: 'AI×ライティング', slug: 'ai-writing' },
      { name: 'AI×動画編集', slug: 'ai-movie' },
      { name: 'AI×SNS', slug: 'ai-sns' },
    ],
  },
] as const;

/** 領域だけの一覧（表示順）。コースを持たない用途はこちらを使う */
export const AREAS: readonly AreaDef[] = AREA_COURSES.map(({ courses, ...area }) => area);

/** 領域名（表示順）。絞り込みプルダウンの並びはこれが正典 */
export const AREA_NAMES: readonly string[] = AREAS.map((a) => a.name);

/** コース1件。領域から切り離しても領域名と順番が分かる形にしておく */
export interface TaxonomyCourse extends CourseDef {
  id: number;
  areaName: string;
  family: AreaFamily;
  /** 領域内の順番（1始まり）。カリキュラム順そのもの */
  indexInArea: number;
}

/** 全コース（領域の表示順 × 領域内のカリキュラム順）。55件 */
export const COURSES: readonly TaxonomyCourse[] = AREA_COURSES.flatMap((area) =>
  area.courses.map((course, i) => ({
    ...course,
    id: area.code * 100 + (i + 1),
    areaName: area.name,
    family: area.family,
    indexInArea: i + 1,
  })),
);

const AREA_BY_NAME = new Map(AREAS.map((a) => [a.name, a]));
const COURSE_BY_SLUG = new Map(COURSES.map((c) => [c.slug, c]));
const COURSE_BY_ID = new Map(COURSES.map((c) => [c.id, c]));

/** slug → コースID。フィクスチャからIDを参照する唯一の経路 */
export const COURSE_ID_BY_SLUG: Readonly<Record<string, number>> = Object.fromEntries(
  COURSES.map((c) => [c.slug, c.id]),
);

export const courseIdOf = (slug: string): number | undefined => COURSE_BY_SLUG.get(slug)?.id;
export const courseBySlug = (slug: string): TaxonomyCourse | undefined => COURSE_BY_SLUG.get(slug);
export const courseById = (id: number): TaxonomyCourse | undefined => COURSE_BY_ID.get(id);
export const areaByName = (name?: string | null): AreaDef | undefined =>
  name ? AREA_BY_NAME.get(name) : undefined;

/**
 * 領域の family。未知の領域名（実BFFが独自のカテゴリ名を返す場合）は
 * 呼び出し側で既定の見た目に落とせるよう undefined を返す。
 */
export const familyOf = (areaName?: string | null): AreaFamily | undefined =>
  areaByName(areaName)?.family;

// ---- 種類（旧「区分」の置き換え）------------------------------------------------

/** 「種類」プルダウンの2値。基礎コースは実践課題の補集合として定義する */
export const COURSE_KIND = {
  basic: '基礎コース',
  practice: '実践課題',
} as const;

export type CourseKind = typeof COURSE_KIND[keyof typeof COURSE_KIND];

/** 実践課題のコース名に付くプレフィックス。命名がそのまま分類になっている */
export const PRACTICE_PREFIX = '実践課題：';

/** 「実践課題」＋（：/:/直結）で始まるか。全角・半角コロンと省略のどれでも拾う */
const startsWithPracticeLabel = (name?: string | null): boolean =>
  /^\s*実践課題\s*[：:]?/.test(name ?? '');

/**
 * コースの種類を決める。判定順は
 *   ① tags に「実践課題」がある（モック・Moodleのタグ）
 *   ② 表示名が「実践課題：〜」で始まる
 *   ③ それ以外はすべて基礎コース
 *
 * ③ が要点。基礎コースを「tagが基礎知識のもの」ではなく実践課題の補集合にしておくと、
 * tags を返さない実BFFでも全コースがどちらかに必ず入り、絞り込みが空振りしない。
 */
export function courseKindOf(course: {
  fullname?: string | null;
  title?: string | null;
  tags?: ReadonlyArray<{ rawname: string }> | null;
}): CourseKind {
  if (course.tags?.some((t) => t.rawname === COURSE_KIND.practice)) return COURSE_KIND.practice;
  if (startsWithPracticeLabel(course.fullname) || startsWithPracticeLabel(course.title)) {
    return COURSE_KIND.practice;
  }
  return COURSE_KIND.basic;
}

/**
 * 「まずここから入れる」コース。領域の先頭 or 名前に入門を示す語を持つもの。
 * 種類（基礎コース）は55件中44件で真になり弁別力が無いので、AI検索の重み付けには
 * こちらを使う。
 *
 * 実践課題は除く。「実践課題：サムネイル制作入門」のように名前に「入門」が入る
 * 実践課題があり、これを入口として勧めると「最初から順番に」という理由文が嘘になる。
 */
const ENTRY_NAME_PATTERN = /基礎|入門|概論|きほん/;

export function isEntryCourse(course: {
  id?: number;
  fullname?: string | null;
  title?: string | null;
  tags?: ReadonlyArray<{ rawname: string }> | null;
}): boolean {
  if (courseKindOf(course) === COURSE_KIND.practice) return false;
  const known = course.id !== undefined ? COURSE_BY_ID.get(course.id) : undefined;
  if (known?.indexInArea === 1) return true;
  return ENTRY_NAME_PATTERN.test(course.fullname ?? course.title ?? '');
}
