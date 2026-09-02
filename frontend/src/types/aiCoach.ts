/**
 * frontend/src/types/aiCoach.ts
 * AIコーチの会話モデル。
 *
 * hooks/useLessonAi.ts に置いていた型をここへ移した理由:
 *   会話の状態を store/aiCoachStore.ts に移し、教材ページの右パネルと
 *   AI専用ページ（拡大表示）が同じ会話を見るようにしたため、
 *   store とフックの双方から参照できる場所が必要になった。
 *   型をフック側に置いたままだと store → hook → store の循環参照になる。
 *
 * 旧名（LessonAiQuote / LessonAiMessage）は useLessonAi.ts から
 * エイリアスで re-export しているので、既存の import は壊れない。
 */

import type { AiSkillResponse, AiSkillId, SkillSuggestion } from './aiSkill';
import type { LessonAiResponse } from './lesson';

/** 教材本文から引用した箇所。AIへ渡す前後文脈まで含む */
export interface AiCoachQuote {
  text: string;
  blockId: string;
  heading: string;
  contextBefore: string;
  contextAfter: string;
}

/**
 * 会話の1件。
 *
 * user      … ユーザーの発言
 * assistant … AIコーチの構造化回答（answer）または専門モードの結果（skillResult）
 * proposal  … 専門モードへ入る前の確認カード（仕様§4-3）。履歴に残すことで
 *             「提案して、ユーザーが選んだ」経過が後から辿れる
 * system    … モードの切り替わりなど、経過の説明
 */
export type AiCoachRole = 'user' | 'assistant' | 'proposal' | 'system';

/** 確認カードの決着。null は未回答（まだボタンが出ている状態） */
export type ProposalResolution = 'accepted' | 'dismissed' | null;

export interface AiCoachMessage {
  id: string;
  role: AiCoachRole;
  /** user / system のとき: 本文 */
  content: string;
  /** user のとき: 引用していた教材本文 */
  quote?: string;
  /** user のとき: 添付画像（dataURL）。永続化からは除外する */
  image?: string;
  /** assistant のとき: 教材に準拠した構造化回答 */
  answer?: LessonAiResponse;
  /** assistant のとき: 専門モードの実行結果 */
  skillResult?: AiSkillResponse;
  /** assistant のとき: 回答の下に控えめに出す提案（仕様§4-2） */
  suggestion?: SkillSuggestion | null;
  /**
   * assistant のとき: この回答が参照したもの（教材の見出し・課題の評価基準・添付画像など）。
   *
   * かつてはヘッダーに「現在参照中」として常設していたが、常に出しておく情報ではない
   * というレビュー指摘で回答の中へ移した。ヘッダー表示なら「いま」の値でよかったが、
   * 回答に添えるなら**その回答を作ったときの値**でなければ嘘になるので、
   * 送信のたびにメッセージへ焼き付ける。
   */
  references?: string[];
  /** proposal のとき: 確認カードの内容と決着 */
  proposal?: SkillSuggestion;
  resolution?: ProposalResolution;
  createdAt: string;
}

/**
 * 会話が参照している文脈。
 * 教材ページから始まった会話なら教材の情報が入り、AI専用ページで
 * 単独に始めた会話なら null が並ぶ。
 */
export interface AiCoachContext {
  courseId: number | null;
  courseName: string | null;
  lessonId: number | null;
  lessonTitle: string | null;
  /** いま読んでいる見出し。スクロールに追従して更新される */
  heading: string | null;
  /** この教材の課題ブロックの見出し。添削の評価基準として参照予定に出す */
  taskHeading: string | null;
  /**
   * 教材ブロック単位の根拠付けができるか。
   * Moodleフォールバック（モックOFF）では false になり、教材根拠を作れない。
   */
  structured: boolean;
}

export const EMPTY_AI_COACH_CONTEXT: AiCoachContext = {
  courseId: null,
  courseName: null,
  lessonId: null,
  lessonTitle: null,
  heading: null,
  taskHeading: null,
  structured: false,
};

export interface AiCoachSession {
  /** 'lesson:123'（教材由来）または 'page:1'（AI専用ページで単独に開始） */
  id: string;
  /**
   * 親会話のID。専門モードのセッションだけが持つ。
   *
   * メインチャットと専門モードの会話を完全に分けると文脈が切れ、
   * 全部を同じ会話に混ぜると履歴が読めなくなる。そこで
   *   AIコーチとの会話（親）
   *   └ 制作物添削セッション（子）
   * の2階層にし、起動時に必要な文脈だけを親からコピーする。
   */
  parentId: string | null;
  /** 会話履歴の一覧に出す名前。最初のユーザー発言から導出する */
  title: string;
  /** 現在の専門モード */
  skillId: AiSkillId;
  messages: AiCoachMessage[];
  context: AiCoachContext;
  /** 入力欄の下書き */
  input: string;
  /** 引用中の教材本文 */
  quote: AiCoachQuote | null;
  /** 添付中の画像（dataURL）。永続化からは除外する */
  image: string | null;
  /**
   * リロードで画像が失われたことをUIに伝える。
   * dataURL は容量が大きく sessionStorage に載せられないため、
   * 復元時は落として「再添付してください」を出す。
   */
  imageDropped: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 教材ページのセッションキー。レッスンが変われば別の会話になる */
export const lessonSessionId = (lessonId: number | null | undefined): string =>
  `lesson:${lessonId ?? 'unknown'}`;
