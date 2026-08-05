/**
 * frontend/src/utils/aiSkillRouting.ts
 * ユーザーの入力から「どの専門モードが適しているか」を判定する。
 *
 * ここに判定ロジックを純粋関数として置き、UI（hooks/useLessonAi.ts）とモック
 * （mocks/lessonHandlers.ts）の双方から import する。utils/learningPlanTemplate.ts と
 * 同じ方針で、ハンドラ側に判断を書かない。UIが出す確認カードとサーバが返す提案が
 * 食い違うと「AIが言っていることと画面が違う」状態になるため。
 *
 * 設計上の判断:
 *  1. 判定しても自動では切り替えない（仕様§4）。この関数は strength を返すだけで、
 *     モードを変えるかどうかは呼び出し側とユーザーが決める。
 *     「このデザインどう思う？」に対してユーザーは軽い意見だけを求めている可能性があり、
 *     毎回専門モードへ飛ばすのは体験を壊す。
 *  2. 追従（stickiness）を持たせる。すでに専門モードに入っているなら、別スキルの
 *     明確なシグナルが出るまで提案し直さない。これが無いと発話ごとにモードが揺れる。
 *  3. 本番ではこの判定はBFF側で行うべき。フロント側の判定は「確認カードを先に出す」
 *     ための先読みであり、サーバが返す suggestion を最終的な正とする。
 */

import { AiSkillId, SkillSuggestion } from '../types/aiSkill';

export interface DetectSkillInput {
  /** ユーザーの質問文 */
  question: string;
  /** 画像を添付しているか */
  hasImage: boolean;
  /** 引用している教材本文 */
  quote: string | null;
  /** 現在のモード。'auto' 以外なら追従を優先する */
  currentSkillId: AiSkillId;
  /** いま読んでいる教材の見出し（参照予定に出す） */
  contextHeading: string | null;
  /** この教材の課題ブロックの見出し（参照予定に出す） */
  taskHeading: string | null;
}

/** 添削・講評を明確に依頼している語 */
const REVIEW_WORDS = [
  '添削',
  'レビュー',
  '講評',
  '評価して',
  'チェックして',
  '見てほしい',
  '見てください',
  'どこを直',
  '直すべき',
  '改善点',
  'フィードバック',
  'アドバイスして',
];

/** 制作物・見た目の話題であることを示す語 */
const DESIGN_WORDS = [
  'デザイン',
  'バナー',
  'サムネ',
  'LP',
  'ランディング',
  '配色',
  '色',
  'レイアウト',
  '文字組',
  '余白',
  '見た目',
  '構図',
  '視線誘導',
  'フォント',
  '作った',
  '制作物',
  '成果物',
  '提出',
];

/** 文章そのものが対象であることを示す語 */
const WRITING_TARGET_WORDS = [
  '文章',
  '文言',
  'コピー',
  'キャッチ',
  '自己PR',
  '自己紹介',
  'プロフィール',
  '説明文',
  'テキスト',
  '言葉づかい',
  '言い回し',
  '表現',
  'メール',
  '返信',
];

/** 文章を直してほしいという動作の語 */
const WRITING_ACTION_WORDS = [
  '書き直',
  'リライト',
  '推敲',
  'ブラッシュアップ',
  '自然に',
  '整えて',
  '短く',
  '読みやすく',
  '直して',
  '改善',
];

/** ツール・環境のトラブルを示す語 */
const TOOLING_WORDS = [
  'エラー',
  '動かない',
  '動きません',
  '表示されない',
  '反映されない',
  '開けない',
  '落ちる',
  'バグ',
  '消えた',
  '保存できない',
  'インストール',
  '設定',
  '使い方がわからない',
];

/** 考えを整理したい・順序を決めたいことを示す語 */
const IDEA_WORDS = [
  '整理',
  '洗い出',
  'アイデア',
  '企画',
  '構成案',
  '何から',
  'どこから',
  '優先',
  '計画',
  '段取り',
  '迷って',
  'まとめたい',
  '決められない',
];

/** 「文章を貼り付けた」と判断する長さ。これ未満は普通の質問文として扱う */
const PASTED_TEXT_MIN = 200;

const hit = (text: string, words: string[]): string | null =>
  words.find((word) => text.includes(word)) ?? null;

/** 参照予定リストを組み立てる。存在しないものは並べない（空欄を見せない） */
function buildReferences(
  skillId: AiSkillId,
  input: DetectSkillInput
): string[] {
  const refs: string[] = [];
  if (input.contextHeading) refs.push(input.contextHeading);

  if (skillId === 'design-review') {
    if (input.taskHeading) refs.push(`${input.taskHeading}の評価基準`);
    if (input.hasImage) refs.push('添付画像');
  }
  if (skillId === 'writing') {
    refs.push(input.quote ? '選択した教材本文' : '入力した文章');
  }
  if (skillId === 'idea' && input.taskHeading) {
    refs.push(input.taskHeading);
  }
  return refs;
}

const none = (currentSkillId: AiSkillId): SkillSuggestion => ({
  skillId: currentSkillId === 'auto' ? 'auto' : currentSkillId,
  strength: 'none',
  reason: '',
  references: [],
});

/**
 * 入力から専門モードを判定する。
 * strength が 'none' のときは呼び出し側は何も出さず、通常のAIコーチとして回答する。
 */
export function detectSkill(input: DetectSkillInput): SkillSuggestion {
  const text = `${input.question} ${input.quote ?? ''}`;
  const raw = detectRaw(input, text);

  // ── 追従（仕様§4）──
  // すでに専門モードにいるなら、同じスキルの再提案はしない。
  // 別スキルへ移すのは explicit なシグナルが出たときだけに限る。
  if (input.currentSkillId !== 'auto') {
    if (raw.skillId === input.currentSkillId) return none(input.currentSkillId);
    if (raw.strength !== 'explicit') return none(input.currentSkillId);
  }
  return raw;
}

function detectRaw(input: DetectSkillInput, text: string): SkillSuggestion {
  const reviewWord = hit(text, REVIEW_WORDS);
  const designWord = hit(text, DESIGN_WORDS);

  // ── 制作物添削 ──
  // 画像が添付されているかどうかで強さを分ける。仕様§4の例がそのままここに対応する。
  //   画像 ＋「添削して」   → explicit（確認カードを先に出す）
  //   画像 のみ            → suggest（まず通常回答し、その下で提案する）
  if (input.hasImage) {
    const strength = reviewWord ? 'explicit' : 'suggest';
    return {
      skillId: 'design-review',
      strength,
      reason: reviewWord
        ? `画像の添付 ＋「${reviewWord}」`
        : '制作物の画像が添付されています',
      references: buildReferences('design-review', input),
    };
  }

  // 画像は無いが明確に制作物の添削を求めている場合。
  // 実行はできないので、画像添付を促すために suggest で返す（仕様§8の導線）。
  if (reviewWord && designWord) {
    return {
      skillId: 'design-review',
      strength: 'suggest',
      reason: `「${designWord}」＋「${reviewWord}」`,
      references: buildReferences('design-review', input),
    };
  }

  // ── 文章改善 ──
  // 長い文章を貼り付けている＝直してほしい対象が本文そのもの、という前提で拾う。
  const pasted = input.question.length >= PASTED_TEXT_MIN;
  const writingAction = hit(text, WRITING_ACTION_WORDS);
  const writingTarget = hit(text, WRITING_TARGET_WORDS);

  if (pasted && writingAction) {
    return {
      skillId: 'writing',
      strength: 'explicit',
      reason: `長い文章の貼り付け ＋「${writingAction}」`,
      references: buildReferences('writing', input),
    };
  }
  if (writingTarget && writingAction) {
    return {
      skillId: 'writing',
      strength: 'suggest',
      reason: `「${writingTarget}」＋「${writingAction}」`,
      references: buildReferences('writing', input),
    };
  }
  if (pasted) {
    return {
      skillId: 'writing',
      strength: 'suggest',
      reason: '長い文章が入力されています',
      references: buildReferences('writing', input),
    };
  }

  // ── トラブル相談 ──
  // 教材の内容ではなく手元の環境の問題なので、教材根拠を探しても当たらない。
  const toolingWord = hit(text, TOOLING_WORDS);
  if (toolingWord) {
    return {
      skillId: 'tooling',
      strength: 'suggest',
      reason: `「${toolingWord}」`,
      references: buildReferences('tooling', input),
    };
  }

  // ── アイデア整理 ──
  const ideaWord = hit(text, IDEA_WORDS);
  if (ideaWord) {
    return {
      skillId: 'idea',
      strength: 'suggest',
      reason: `「${ideaWord}」`,
      references: buildReferences('idea', input),
    };
  }

  // 教材についての普通の質問。専門モードは要らない。
  return none(input.currentSkillId);
}

export default detectSkill;
