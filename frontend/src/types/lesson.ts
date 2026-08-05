/**
 * frontend/src/types/lesson.ts
 * 教材学習ワークスペース（/course/:courseId?module=）のドメイン型。
 *
 * これらのAPIは実BFF（FastAPI）に存在しない。バックエンドは変更禁止のため、
 * すべて MSW（frontend/src/mocks/lessonHandlers.ts）で提供している。
 * 型はモックとクライアント（bffClient）の双方から import して、
 * 片方だけがズレることを防ぐ（types/coaching.ts と同じ方針）。
 *
 * 設計上の要点:
 *   教材本文を「ブロック配列」で持つ。ブロックの id が
 *     - クリップ（選択文章）の保存位置
 *     - AI回答の「参照した教材箇所」
 *     - AIへ渡す教材検索の単位
 *   すべてのアンカーになる。従来の iframe 描画ではこれが取れなかった。
 */

// aiSkill.ts とは型だけを相互に参照する。import type にしておけばコンパイル時に
// 消えるため、実行時の循環参照は起きない。
import type { AiSkillId, SkillSuggestion } from './aiSkill';
// 階層（コース＞単元＞レッスン＞教材）と、階層に混ぜない分類（学習タイプ・教材形式）の
// 定義は constants/learningTaxonomy.ts が単一の情報源。
import type { LearningType, MaterialFormat } from '../constants/learningTaxonomy';

// ---- 教材（レッスン本文を構成するコンテンツ）--------------------------------

/**
 * 教材ブロックの種別。描画の出し分けと、AIの教材検索の重み付けに使う。
 * 受講生に見せる「教材形式（テキスト・動画・クイズ…）」より細かい実装上の区分で、
 * 表示名は LESSON_BLOCK_KIND_LABEL を使う。
 */
export type LessonBlockKind =
  | 'text'     // 通常の本文
  | 'figure'   // 図解・画像
  | 'video'    // 補足動画
  | 'example'  // 具体例（改善前後など）
  | 'callout'  // 注意点・判断基準
  | 'quiz'     // 確認問題
  | 'task'     // 課題・実践への導線
  | 'summary'; // この教材のまとめ

export const LESSON_BLOCK_KIND_LABEL: Record<LessonBlockKind, string> = {
  text: '本文',
  figure: '図解',
  video: '補足動画',
  example: '具体例',
  callout: '注意点',
  quiz: '確認問題',
  task: '課題',
  summary: 'まとめ',
};

export interface LessonQuizChoice {
  text: string;
  correct: boolean;
  explain: string; // 選んだときに出す短い解説
}

export interface LessonBlock {
  id: string;      // 安定ID。クリップ位置とAI参照箇所のアンカー
  heading: string; // 属する見出し。AIへ渡す「現在の見出し」
  kind: LessonBlockKind;
  html: string;    // 表示用。描画時に DOMPurify.sanitize する
  plain: string;   // 検索・AI根拠付け・前後文脈の切り出し用（タグなし）
  quiz?: { question: string; choices: LessonQuizChoice[] };
  media?: { src: string; alt?: string; caption?: string };
}

/**
 * 教材本文の取得元。
 * structured      … モックの構造化教材。選択ツールバー・クリップ・ブロック参照が有効
 * moodle-fallback … モックOFF時。実Moodle HTMLを従来どおり iframe 描画する縮退モード
 */
export type LessonSource = 'structured' | 'moodle-fallback';

export interface LessonDoc {
  courseId: number;
  courseName: string;
  lessonId: number;
  title: string;
  lead: string;              // リード文（このレッスンの概要）
  goals: string[];           // このレッスンでできるようになること
  estimatedMinutes: number;  // 読了目安
  /** 学習タイプ（このレッスンの目的・進め方）。階層ではなくレッスンに付ける分類。 */
  learningType?: LearningType;
  /** 主となる教材形式。レッスン内の教材が複数形式なら代表的なものを入れる。 */
  materialFormat?: MaterialFormat;
  blocks: LessonBlock[];
  summary: string;           // このレッスンのまとめ
  nextAction: string;        // 次にやること
  prev: LessonLink | null;
  next: LessonLink | null;
  source: LessonSource;
  /** moodle-fallback のときだけ入る。従来の iframe 描画に渡す生HTML。 */
  fallbackHtml?: string;
  /** moodle-fallback のときだけ入る。modname 由来のコンテンツ種別。 */
  fallbackModname?: string;
}

export interface LessonLink {
  lessonId: number;
  title: string;
}

// ---- コースの目次（単元 ＞ レッスン）----------------------------------------

export type LessonState = 'done' | 'active' | 'todo';

export const LESSON_STATE_LABEL: Record<LessonState, string> = {
  done: '完了',
  active: '学習中',
  todo: '未学習',
};

export interface OutlineLesson {
  lessonId: number;
  title: string;
  minutes: number;
  state: LessonState;
  /** 学習タイプ。目次で「これは実践課題」と分かるようにするため */
  learningType?: LearningType;
}

/** 単元（コース内のテーマ別まとまり）。旧「セクション」。 */
export interface OutlineSection {
  id: number;
  name: string;
  lessons: OutlineLesson[];
}

export interface LessonOutline {
  courseId: number;
  courseName: string;
  progressPercent: number; // 0-100
  sections: OutlineSection[];
}

// ---- AIコーチ --------------------------------------------------------------

export interface LessonAiHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * AIへ渡す情報（要件 §8）。
 * 現在のレッスン名だけでなく、選択文章とその前後・ブロックIDまで渡すことで、
 * サーバ側が教材を検索して回答根拠に使えるようにする。
 */
export interface LessonAiRequest {
  courseId: number;
  lessonId: number;
  blockId: string | null;
  heading: string | null;
  selectedText: string | null;
  contextBefore: string | null;
  contextAfter: string | null;
  question: string;
  image?: string; // 添付画像（dataURL）
  history: LessonAiHistoryItem[];
  mode: LessonAiMode;
  /**
   * 現在の専門モード。サーバ側で意図判定するときの追従（stickiness）に使う。
   * すでに添削モードにいるユーザーへ添削モードを再提案しないため、
   * 判定にはクライアントの現在状態が必要になる。
   */
  skillId?: AiSkillId;
}

/**
 * chat  … 右パネルのAIコーチ。構造化回答をフルで返す
 * brief … 選択文章の「💡かんたん解説」。conclusion のみ短く使う
 */
export type LessonAiMode = 'chat' | 'brief';

export interface LessonAiSource {
  blockId: string;
  heading: string;
}

/**
 * 回答形式（要件 §8）。
 * groundedInMaterial が false のときは「この教材だけでは判断できません」を出し、
 * generalNote を教材外の一般的な補足として明確に区別して表示する。
 */
export interface LessonAiResponse {
  conclusion: string;
  basis: string;
  apply: string;
  next: string;
  sources: LessonAiSource[];
  groundedInMaterial: boolean;
  generalNote: string | null;
  /**
   * 専門モードの提案（仕様§4-2）。
   * 「まず通常回答し、その下で提案する」ためにレスポンスへ同梱する。
   * strength が 'none' か未設定なら何も出さない。
   * 型は types/aiSkill.ts 側に置いてある（判定ロジックは utils/aiSkillRouting.ts）。
   */
  suggestion?: SkillSuggestion | null;
}
