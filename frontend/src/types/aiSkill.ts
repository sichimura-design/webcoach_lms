/**
 * frontend/src/types/aiSkill.ts
 * AIコーチの「専門モード」のドメイン型。
 *
 * 設計の中心:
 *   AIコーチは相談相手。従来「AIアプリ」として一覧に並べて別タブで開いていたものは、
 *   AIコーチが必要に応じて使う専門スキルとして裏に隠す。
 *   よってユーザー向けの語彙は「モード」で統一し、UIには "Dify" も "アプリ" も出さない。
 *
 * これらのAPIは実BFF（FastAPI）に存在しない。バックエンドは変更禁止のため、
 * すべて MSW（frontend/src/mocks/aiSkillHandlers.ts）で提供する。
 * 型はモックとクライアント（bffClient）の双方から import して、
 * 片方だけがズレることを防ぐ（types/lesson.ts と同じ方針）。
 */

// lesson.ts とは型だけを相互に参照する（import type なので実行時の循環参照は起きない）
import type { LessonAiHistoryItem, LessonAiSource } from './lesson';

/**
 * 専門モードの識別子。
 * 'auto' は「まだ判定していない／おまかせ」を表す擬似スキルで、
 * 実行API（POST /webcoach/ai-skill）には渡らない。
 */
export type AiSkillId = 'auto' | 'learning' | 'design-review' | 'writing' | 'idea' | 'tooling';

/** モードセレクタに出す表示名。ユーザーにはこの語彙しか見せない（仕様§7） */
export const AI_SKILL_LABEL: Record<AiSkillId, string> = {
  auto: 'おまかせ',
  learning: '学習について質問',
  'design-review': '制作物を添削',
  writing: '文章を改善',
  idea: 'アイデアを整理',
  tooling: 'ツール・エラーについて質問',
};

/**
 * 専門モードに入っているときのヘッダー表示名。
 * セレクタの選択肢名（動詞）とヘッダー（状態）で語尾を変えないと、
 * 「制作物を添削モード」のような不自然な日本語になる。
 */
export const AI_SKILL_MODE_LABEL: Record<AiSkillId, string> = {
  auto: 'おまかせ',
  learning: '学習相談モード',
  'design-review': '制作物添削モード',
  writing: '文章改善モード',
  idea: 'アイデア整理モード',
  tooling: 'トラブル相談モード',
};

/** 提案カードの見出しに使う短い名前。「✦ 制作物添削 が適しています」の形で使う */
export const AI_SKILL_SHORT_LABEL: Record<AiSkillId, string> = {
  auto: 'おまかせ',
  learning: '学習相談',
  'design-review': '制作物添削',
  writing: '文章改善',
  idea: 'アイデア整理',
  tooling: 'トラブル相談',
};

/**
 * 提案カードのボタン文言。
 * ここは意図的に「アプリを起動」ではなくユーザーの目的語にしている。
 * 何が起きるかを取り違えさせないため（components/coaching の命名方針と同じ）。
 */
export const AI_SKILL_CTA: Record<AiSkillId, string> = {
  auto: '続ける',
  learning: '教材に沿って詳しく調べる',
  'design-review': '項目別に添削する',
  writing: '文章を書き直す',
  idea: '考えを整理する',
  tooling: '原因を順に切り分ける',
};

/** セレクタに並べる順序。'auto' を先頭に固定する */
export const AI_SKILL_ORDER: AiSkillId[] = [
  'auto',
  'learning',
  'design-review',
  'writing',
  'idea',
  'tooling',
];

/** 実行APIに渡せる実スキル（'auto' を除いたもの） */
export type ConcreteAiSkillId = Exclude<AiSkillId, 'auto'>;

export const isConcreteSkill = (id: AiSkillId): id is ConcreteAiSkillId => id !== 'auto';

/**
 * 専門モードの実行API（POST /webcoach/ai-skill）に回すスキル。
 * 'learning' を含めないのは意図的。「学習について質問」は右パネルのAIコーチが
 * 従来から POST /webcoach/lesson-ai でやっていることそのもので、
 * 別のエンドポイントに回すと同じ処理が二重になる。
 */
export const SPECIALIST_SKILLS: ConcreteAiSkillId[] = [
  'design-review',
  'writing',
  'idea',
  'tooling',
];

export const isSpecialistSkill = (id: AiSkillId): id is ConcreteAiSkillId =>
  (SPECIALIST_SKILLS as AiSkillId[]).includes(id);

/**
 * 制作物の画像が無いと成立しないスキル。
 * 画像未添付で提案するときは、実行ボタンではなく画像添付を促す（仕様§8の導線）。
 */
export const AI_SKILL_NEEDS_IMAGE: Record<AiSkillId, boolean> = {
  auto: false,
  learning: false,
  'design-review': true,
  writing: false,
  idea: false,
  tooling: false,
};

/**
 * 右パネルでは手狭になりやすく、AI専用ページへの拡大を勧めたいスキル（仕様§6）。
 * 「修正して再添削を繰り返す」「長い文章を作る」類の作業がこれに当たる。
 */
export const AI_SKILL_PREFER_WIDE: Record<AiSkillId, boolean> = {
  auto: false,
  learning: false,
  'design-review': true,
  writing: true,
  idea: false,
  tooling: false,
};

// ---- 意図判定の結果 --------------------------------------------------------

/**
 * 判定の強さ。仕様§4「自動で切り替えず、提案にする」の3段階に対応する。
 *
 * none     … 軽い質問。AIコーチがそのまま回答するだけ
 * suggest  … 専門処理が有効かもしれない。まず通常回答し、その下で提案する
 * explicit … 明確に専門処理を求めている。回答の前に確認カードを出す
 */
export type SkillSuggestionStrength = 'none' | 'suggest' | 'explicit';

export interface SkillSuggestion {
  skillId: AiSkillId;
  strength: SkillSuggestionStrength;
  /** 「画像添付 ＋ 『添削』」のような判定根拠。提案カードに小さく出す */
  reason: string;
  /** 提案カードの「参照予定」に並べるラベル（教材見出し／課題の評価基準／添付画像） */
  references: string[];
}

// ---- 専門スキルの実行 ------------------------------------------------------

/**
 * 専門モードの実行リクエスト。
 * 本番ではBFFが skillId を Difyアプリの資格情報へ解決して代理呼び出しする。
 * フロントは skillId までしか知らない（アプリIDやURLを持たない）。
 */
export interface AiSkillRequest {
  skillId: ConcreteAiSkillId;
  question: string;
  /** 添付画像（dataURL） */
  image?: string;
  /** 引用していた教材本文 */
  quote: string | null;
  courseId: number | null;
  lessonId: number | null;
  /** 参照する教材ブロック。空なら教材横断で探す */
  blockIds: string[];
  history: LessonAiHistoryItem[];
}

/** 項目別添削の1項目。verdict で色分けする */
export type AiSkillVerdict = 'good' | 'improve' | 'critical';

export const AI_SKILL_VERDICT_LABEL: Record<AiSkillVerdict, string> = {
  good: '良い',
  improve: '改善できる',
  critical: '直したい',
};

export interface AiSkillFinding {
  /** 「配色」「余白」「文字組」など観点の名前 */
  label: string;
  verdict: AiSkillVerdict;
  comment: string;
  /** 教材の根拠。null なら教材に裏付けが無い項目 */
  basis: string | null;
  /** 根拠にした教材ブロック。UIから教材へジャンプさせる */
  blockId: string | null;
}

/**
 * 専門モードの回答。
 * LessonAiResponse（結論／根拠／当てはめ／…）と違い、こちらは
 * 「項目別に並べて、直して、再度見る」作業のための形にしている。
 */
export interface AiSkillResponse {
  skillId: ConcreteAiSkillId;
  /** 全体講評。1〜2文 */
  summary: string;
  findings: AiSkillFinding[];
  /** 文章改善モードの修正案。添削モードでは null */
  revision: string | null;
  next: string;
  sources: LessonAiSource[];
  /**
   * 教材に根拠を持てたか。false のときはUI側で
   * 「教材だけでは判断できません」を明示する（LessonAiResponse と同じ扱い）。
   */
  groundedInMaterial: boolean;
}
