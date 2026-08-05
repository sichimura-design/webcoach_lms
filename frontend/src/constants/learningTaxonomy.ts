/**
 * frontend/src/constants/learningTaxonomy.ts
 * 学習コンテンツの階層と分類の「呼び方」を集約する。
 *
 * 画面ごとに「ステップ」「セクション」「チャプター」「カテゴリ」と呼び方が散っていたため、
 * 受講生に見せる階層名はすべてここを通す。階層は次の5段階だけ。
 *
 *   学習領域 ＞ コース ＞ 単元 ＞ レッスン ＞ 教材
 *
 * 重要な前提: 「基礎知識」「実践課題」「座学」などは階層ではない。
 * 何を学ぶか（階層）と、どう学ぶか（分類）を混ぜると、同じテーマの学習が
 * 座学と実践に分断されてしまう。そのため
 *   - どう学ぶか  → レッスンに付ける「学習タイプ」
 *   - どんな形式か → 教材に付ける「教材形式」
 * として階層の外に置く。
 *
 * UI上は5階層すべてを毎回出さない（要件）。
 *   学習領域 … 学習コンテンツ一覧の絞り込みでのみ見せる
 *   教材    … レッスン本文の中に自然に並べる
 * 受講生が普段たどるのは「コース ＞ 単元 ＞ レッスン」の3階層。
 */

export const LEARNING_HIERARCHY = {
  area: '学習領域',
  course: 'コース',
  unit: '単元',
  lesson: 'レッスン',
  material: '教材',
} as const;

export type LearningHierarchyLevel = keyof typeof LEARNING_HIERARCHY;

/** 「単元1」「レッスン3」のような序数付きラベル。index は1始まり。 */
export const unitLabel = (index: number): string => `${LEARNING_HIERARCHY.unit}${index}`;
export const lessonLabel = (index: number): string => `${LEARNING_HIERARCHY.lesson}${index}`;

/**
 * 学習タイプ（レッスンに付ける）。学習の目的と進め方を表す。
 * 「座学」は受け身な印象が強いので、受講生向けUIでは「基礎知識」を使う。
 */
export type LearningType = 'intro' | 'knowledge' | 'drill' | 'assignment' | 'test' | 'review';

export const LEARNING_TYPE_LABEL: Record<LearningType, string> = {
  intro: 'イントロダクション',
  knowledge: '基礎知識',
  drill: '演習',
  assignment: '実践課題',
  test: '確認テスト',
  review: '振り返り',
};

/** 教材形式（教材に付ける）。実際に閲覧・提出するコンテンツの形。 */
export type MaterialFormat =
  | 'text'
  | 'video'
  | 'quiz'
  | 'work'
  | 'production'
  | 'submission'
  | 'aiDrill'
  | 'link';

export const MATERIAL_FORMAT_LABEL: Record<MaterialFormat, string> = {
  text: 'テキスト',
  video: '動画',
  quiz: 'クイズ',
  work: 'ワーク',
  production: '制作課題',
  submission: 'ファイル提出',
  aiDrill: 'AI演習',
  link: '外部リンク',
};
