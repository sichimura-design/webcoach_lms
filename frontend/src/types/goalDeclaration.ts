/**
 * 目標宣言 — 受講生が自分の言葉で、期間を切って書く意思表明と、その振り返り。
 * ============================================================
 * 現行の「学習管理シート」にある目標宣言欄に当たるもの。
 *
 * 既存の目標3系統とは別物なので、統合しないこと:
 *
 *   CoachingGoalApi（types/mypage.ts）
 *     コーチが確定し、受講生はチェックを付けるだけ。粒度はタスク。progress% を持つ。
 *     → 書き手が違う。統合すると「コーチが決めた目標を受講生が書き換えた」データが生まれる。
 *
 *   Profile.weekly_target_minutes（hooks/useWeeklyGoal.ts）
 *     週に何分やるかという「量」の目標。
 *     → だから GoalDeclaration に targetMinutes を持たせない。持たせると
 *        「今週の目標」が画面に2つできて、どちらが正か分からなくなる。
 *
 *   LearningPlan.goal / goalDeadline（types/learningPlan.ts）
 *     ロードマップが生成する半年〜の最終ゴール。
 *     → こちらは数週間〜1ヶ月の、本人が今この期間に何をやると決めたか。
 *
 * 🔴 進捗率・達成率の数値を持たせない。
 *    design-token-spec.md の「理解度%などの学習効果を数値化した指標は表示しない」に
 *    触れる。達成したかどうかは status の語彙で、手応えは既存の Achievement
 *    （もう少し／できた／バッチリ）の3語で表す。新しい尺度を作らない。
 *
 * 🔴 「いま有効な宣言」をサーバのレスポンスに含めない。
 *    今日どれが有効かは periodFrom/periodTo と今日の日付から一意に決まる。
 *    サーバとクライアントの2箇所で持つと必ずズレるので、
 *    utils/goalDeclaration.ts の activeDeclaration() を唯一の実装にする。
 *
 * 🔴 status は「ユーザーの意思」、期間の経過は「時計の話」。混ぜないこと。
 *    期限が来ただけで missed に書き換わると、本人が振り返る前に
 *    「できなかった」と決めつけることになる。期間の経過は declarationPhase() で導出する。
 *
 * これらのAPIは実BFF（FastAPI）に存在しない。バックエンドは変更禁止のため、
 * すべて MSW（mocks/goalDeclarationHandlers.ts）で提供している。
 * ============================================================
 */
import { Achievement } from './studyActivity';

export type GoalDeclarationStatus = 'active' | 'achieved' | 'missed' | 'abandoned';

export const GOAL_DECLARATION_STATUS_LABEL: Record<GoalDeclarationStatus, string> = {
  active: '進行中',
  achieved: '達成した',
  missed: '届かなかった',
  abandoned: 'やめた',
};

/**
 * 宣言文の上限。
 * 一言で言い切れることに意味があるので、メモ類（TEXT_MAX_LENGTH = 500）より短くする。
 */
export const DECLARATION_TEXT_MAX = 120;

/** 振り返りの上限。studyStats.TEXT_MAX_LENGTH と同値（localStorage の容量方針を1本にする） */
export const DECLARATION_REFLECTION_MAX = 500;

export interface GoalDeclaration {
  /** `gd-<epochMs>-<base36>`。クライアント生成 = POST の冪等キー */
  id: string;
  userId: number;
  /** 宣言文。「9月中にLPを1本、自分の手で完成させる」 */
  text: string;
  /** 対象期間（端末ローカル日 YYYY-MM-DD）。localDate と同じキー空間 */
  periodFrom: string;
  periodTo: string;
  status: GoalDeclarationStatus;
  /** 期間が終わったあとに書く振り返り。未記入は null */
  reflection: string | null;
  /** 手応え。★や%ではなく既存の3語ラベルを再利用する */
  reflectionAchievement: Achievement | null;
  reflectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  schemaVersion: 1;
}

/** POST body。id はクライアントで確定させる（冪等） */
export interface GoalDeclarationInput {
  id: string;
  text: string;
  periodFrom: string;
  periodTo: string;
}

/** PATCH body。触っていない項目は undefined（= 変更なし） */
export interface GoalDeclarationPatch {
  text?: string;
  periodFrom?: string;
  periodTo?: string;
  status?: GoalDeclarationStatus;
  reflection?: string | null;
  reflectionAchievement?: Achievement | null;
}

export interface GoalDeclarationQuery {
  status?: GoalDeclarationStatus;
  limit?: number;
}
