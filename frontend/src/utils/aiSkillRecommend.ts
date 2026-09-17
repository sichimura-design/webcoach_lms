/**
 * frontend/src/utils/aiSkillRecommend.ts
 * 「あなたにおすすめ」の組み立て（要件「AIアプリ一覧の見せ方」）。
 *
 * 一覧を全件同じ大きさで並べると結局どれを使うか迷うため、いまの学習状況から
 * 3件だけを先に出す。判定は純粋関数にしてここへ寄せる。画面側（AiCoachHome）に
 * if を積むと、勧める理由と表示文が離れて食い違うため。
 *
 * 新しいAPIは作らない。マイページが既に取得しているコース情報
 * （コース名・カテゴリ・いま取り組むレッスン・進捗）だけを根拠にする。
 * ここで根拠に使えないものを「おすすめの理由」に書かないこと。書いた瞬間に嘘になる。
 */

import { ConcreteAiSkillId } from '../types/aiSkill';

export interface AiSkillRecommendation {
  skillId: ConcreteAiSkillId;
  /** カードの見出し。やることの名前で書く */
  title: string;
  /** なぜ勧めるか。学習状況を根拠にした1文 */
  reason: string;
  /** 起動時に入力欄へ流し込む下書き。無ければ空のまま開く */
  seedInput?: string;
}

export interface RecommendInput {
  courseTitle?: string | null;
  categoryName?: string | null;
  /** いま取り組むレッスン名 */
  currentLesson?: string | null;
  /** コースの進捗（%） */
  progress?: number | null;
  /** 最近使った機能。すでに使っているものを勧め直さない */
  usedSkills?: ConcreteAiSkillId[];
}

/**
 * 学習領域から、その領域で最初に効く機能を1つ選ぶ。
 * 現行の領域（constants/courseTaxonomy.ts の AREAS）すべてを網羅する。
 * 🔴 領域名を変えたらここも直すこと。網羅していない領域は FALLBACK_ORDER に落ちて、
 *    学習領域を見ていないのと同じ結果になる（型では検出できない）。
 */
const CATEGORY_SKILL: Array<{ match: RegExp; skillId: ConcreteAiSkillId }> = [
  // 「Web×AI」「生成AI基礎」を先に見る（「Web×AI」は下のデザイン/制作にも当たるため）
  { match: /AI/, skillId: 'learning' },
  { match: /動画/, skillId: 'video-review' },
  { match: /デザイン/, skillId: 'design-review' },
  { match: /Web制作|コーディング|コード|プログラ/, skillId: 'learning' },
  { match: /マーケ|ライティング|セールス/, skillId: 'copy' },
  { match: /SNS/, skillId: 'copy' },
  { match: /キャリア|副業|案件|学習ガイド/, skillId: 'job-search-crowdworks' },
];

/** 教材名から拾う、より具体的な手がかり。カテゴリより優先する */
const TITLE_SKILL: Array<{ match: RegExp; skillId: ConcreteAiSkillId }> = [
  { match: /動画|ムービー|ショート/, skillId: 'video-review' },
  { match: /バナー|サムネ|LP|ロゴ|チラシ|ポートフォリオサイト/, skillId: 'design-review' },
  { match: /キャッチ|コピー|見出し/, skillId: 'copy' },
  { match: /面接|面談|商談/, skillId: 'interview' },
  { match: /応募|提案|営業/, skillId: 'application' },
];

/** 学習状況に依存しない、迷ったときの並び。ここから穴埋めする */
const FALLBACK_ORDER: ConcreteAiSkillId[] = [
  'design-review',
  'daily-design-sprint',
  'learning',
  'copy',
  'glossary',
  'job-search-crowdworks',
];

/** 機能ごとの既定の見出し・理由。学習状況が取れないときはこの文言で出す */
const GENERIC: Record<ConcreteAiSkillId, { title: string; reason: string }> = {
  learning: {
    title: '教材の分からない箇所を聞く',
    reason: '教材のどこに書いてあるかを示しながら答えます。',
  },
  glossary: {
    title: '知らない用語をやさしく言い換える',
    reason: '専門用語をそのまま覚えるより、言い換えた方が先に進めます。',
  },
  'daily-design-sprint': {
    title: '今日のデザイン課題に取り組む',
    reason: '使える時間から課題を出すので、何を作るか決める前に手が動きます。',
  },
  'design-review': {
    title: '制作物を提出前にチェックする',
    reason: '画像を添付すると、教材の基準で改善点を確認できます。',
  },
  'video-review': {
    title: '編集した動画を見てもらう',
    reason: 'テンポとテロップは、作った本人だと気づきにくいところです。',
  },
  copy: {
    title: 'キャッチコピーの案を並べて比べる',
    reason: '狙いの違う案を並べると、決めやすくなります。',
  },
  application: {
    title: '応募文の骨組みを作る',
    reason: '募集内容に1つずつ答える形にすると読まれます。',
  },
  interview: {
    title: 'AIと面接の練習をする',
    reason: '声に出して答える練習を、相手を待たずにできます。',
  },
  'job-search-crowdworks': {
    title: 'クラウドワークスで受けられる案件を絞る',
    reason: 'できることと使える時間を整理すると、探す範囲が決まります。',
  },
  'job-search-coconala': {
    title: 'ココナラで受けられる案件を絞る',
    reason: 'できることと使える時間を整理すると、探す範囲が決まります。',
  },
  'job-search-lancers': {
    title: 'ランサーズで受けられる案件を絞る',
    reason: 'できることと使える時間を整理すると、探す範囲が決まります。',
  },
};

const firstMatch = (
  text: string | null | undefined,
  table: Array<{ match: RegExp; skillId: ConcreteAiSkillId }>
): ConcreteAiSkillId | null => {
  if (!text) return null;
  return table.find((row) => row.match.test(text))?.skillId ?? null;
};

/**
 * おすすめを最大3件返す。
 * 学習状況から根拠が作れたものを前に出し、足りない分を FALLBACK_ORDER で埋める。
 */
export function buildRecommendations(input: RecommendInput): AiSkillRecommendation[] {
  const { courseTitle, categoryName, currentLesson, progress } = input;
  const used = new Set(input.usedSkills ?? []);
  const picked: AiSkillRecommendation[] = [];
  const seen = new Set<ConcreteAiSkillId>();

  const add = (rec: AiSkillRecommendation) => {
    if (seen.has(rec.skillId) || picked.length >= 3) return;
    seen.add(rec.skillId);
    picked.push(rec);
  };

  const lessonName = currentLesson || courseTitle || null;

  // ① いま取り組んでいる教材から。ここが一番当たるので先に置く
  const fromLesson = firstMatch(currentLesson, TITLE_SKILL) ?? firstMatch(courseTitle, TITLE_SKILL);
  if (fromLesson && lessonName) {
    add({
      skillId: fromLesson,
      title:
        fromLesson === 'design-review'
          ? `${lessonName}の提出前チェック`
          : `${lessonName}で使う${GENERIC[fromLesson].title}`,
      reason: `いま「${lessonName}」に取り組んでいるため、${GENERIC[fromLesson].reason}`,
      seedInput:
        fromLesson === 'design-review'
          ? `${lessonName}の制作物を、教材の基準で添削してください`
          : undefined,
    });
  }

  // ② 進捗から。終盤なら手を動かす練習、序盤なら教材の理解を優先する
  // 🔴 終盤に勧めていた「理解度チェック」はアプリが無くなったので、
  //    同じ「仕上げに効くもの」としてデイリーデザインスプリントに置き換えた。
  if (typeof progress === 'number' && lessonName) {
    if (progress >= 70) {
      add({
        skillId: 'daily-design-sprint',
        title: `${lessonName}で学んだことを課題で試す`,
        reason: `このコースを${Math.round(progress)}%まで進めているため、学んだ範囲を手を動かして確かめると定着します。`,
        seedInput: `「${lessonName}」で学んだことを試せる課題を出してください`,
      });
    } else if (progress <= 30) {
      add({
        skillId: 'learning',
        title: `${lessonName}の分からない箇所を聞く`,
        reason: `始めたばかりの範囲のため、${GENERIC.learning.reason}`,
      });
    }
  }

  // ③ 学習領域から
  const fromCategory = firstMatch(categoryName, CATEGORY_SKILL);
  if (fromCategory && categoryName) {
    add({
      skillId: fromCategory,
      title: GENERIC[fromCategory].title,
      reason: `${categoryName}を学習中のため、${GENERIC[fromCategory].reason}`,
    });
  }

  // ④ 足りない分を埋める。最近使ったものは後回しにする
  const rest = FALLBACK_ORDER.filter((id) => !used.has(id)).concat(FALLBACK_ORDER);
  rest.forEach((id) => add({ skillId: id, ...GENERIC[id] }));

  return picked;
}

export default buildRecommendations;
