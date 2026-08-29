/**
 * frontend/src/types/learningPlan.ts
 * 長期学習ロードマップ（半年〜1年スパン）の型定義。
 * ============================================================
 * 【設計の前提】
 * - 指導方法はコーチに任せ、**ロードマップの構造と更新方法だけをLMS側で標準化**する。
 *   そのためフェーズは固定（自由記述で増やせるのは 'custom' のみ）、マイルストーンは
 *   候補テンプレートからの選択を既定とし、自由記述は最小限に留める。
 * - **コーチはLMSアカウントを持たず、LMSを操作しない**（docs/ai-coaching-notes-design.md）。
 *   よって編集・確定の操作主体は受講生本人であり、コーチングの場で受講生が画面共有しながら
 *   コーチと一緒に操作する。「コーチが承認する」ステートは存在しない。
 * - LMSの自動生成物が黙って「コーチ合意済み」に昇格しないよう PlanStatus で段階を分ける
 *   （types/coaching.ts の GoalState と同じ発想）。
 *
 * 【命名について】
 *   このリポジトリの "roadmap" は既に別物を指す（実BFFのカリキュラム雛形 template_roadmaps /
 *   モック専用の Journey）。衝突を避けるため本機能は LearningPlan と呼ぶ。UI表示は「学習ロードマップ」。
 * ============================================================
 */

// ---- フェーズ ---------------------------------------------------------------

/**
 * 全受講生共通のフェーズ。コーチごとのブレをなくすため LMS 側で固定する。
 * 変更できるのは各フェーズの「期間 / スキル / マイルストーン / 優先順位 / 開始・終了予定日」であって、
 * フェーズそのものではない。どうしても足りないときだけ 'custom' を追加する。
 */
export type PhaseKey =
  | 'foundation'
  | 'tools'
  | 'practice'
  | 'mock_project'
  | 'portfolio'
  | 'job_hunting'
  | 'client_work'
  | 'custom';

export const PHASE_LABEL: Record<PhaseKey, string> = {
  foundation: '基礎・座学',
  tools: 'ツール学習',
  practice: '制作練習',
  mock_project: '模擬案件',
  portfolio: 'ポートフォリオ制作',
  job_hunting: '案件獲得チャレンジ',
  client_work: '実案件・継続獲得',
  custom: 'カスタムフェーズ',
};

/** 標準フェーズの並び順（'custom' を除く7つ）。生成もタイムライン表示もこの順を正とする。 */
export const STANDARD_PHASE_ORDER: PhaseKey[] = [
  'foundation',
  'tools',
  'practice',
  'mock_project',
  'portfolio',
  'job_hunting',
  'client_work',
];

/** 「案件獲得まで進みたいか」が false のとき落とすフェーズ。 */
export const CLIENT_WORK_PHASES: PhaseKey[] = ['job_hunting', 'client_work'];

// ---- ステージ（フェーズをまとめた表示単位） ---------------------------------

/**
 * 画面に出す粒度。**表示専用でありデータは7フェーズのまま**である点が要点。
 *
 * 7フェーズをそのまま並べると1つ遅れただけで「6つ先まで押している」ように見え、
 * 実際には計画どおりでも遅れている印象を与えてしまう。ステージ単位なら
 * 「いま2つ目」で済み、内訳は現在ステージの中だけ開く。
 * 保存形式を変えないので、期間調整・差分適用のロジックは一切影響を受けない。
 */
export type StageKey = 'basics' | 'practice' | 'prepare' | 'challenge';

export const STAGE_ORDER: StageKey[] = ['basics', 'practice', 'prepare', 'challenge'];

export const STAGE_LABEL: Record<StageKey, string> = {
  basics: '基礎',
  practice: '実践',
  prepare: '準備',
  challenge: '挑戦',
};

/** レール上でステージ名に添える一言。中身が分からないまま丸められるのを防ぐ。 */
export const STAGE_NOTE: Record<StageKey, string> = {
  basics: '座学・ツール学習',
  practice: '実践課題・模擬案件',
  prepare: 'ポートフォリオ作成',
  challenge: '案件獲得',
};

export const STAGE_OF_PHASE: Record<PhaseKey, StageKey> = {
  foundation: 'basics',
  tools: 'basics',
  practice: 'practice',
  mock_project: 'practice',
  portfolio: 'prepare',
  job_hunting: 'challenge',
  client_work: 'challenge',
  // 自由追加フェーズは手を動かす段に置く（挑戦に混ざると「案件獲得」の意味が濁るため）
  custom: 'practice',
};

/** deriveStages() が返す表示用のまとまり。保存はしない。 */
export interface PlanStage {
  key: StageKey;
  title: string;
  note: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  status: PhaseProgressStatus;
  /** このステージに属するフェーズ（plan.phases の並び順を保つ） */
  phases: PlanPhase[];
  /** phases と同じ並びの状態 */
  phaseStatuses: PhaseProgressStatus[];
}

// ---- スキル -----------------------------------------------------------------

export type SkillKey =
  | 'design_basics'
  | 'banner'
  | 'lp'
  | 'coding'
  | 'wordpress'
  | 'ui_ux'
  | 'video'
  | 'marketing';

export const SKILL_LABEL: Record<SkillKey, string> = {
  design_basics: 'デザイン基礎',
  banner: 'バナー制作',
  lp: 'LP制作',
  coding: 'コーディング',
  wordpress: 'WordPress',
  ui_ux: 'UI/UXデザイン',
  video: '動画編集',
  marketing: 'Webマーケティング',
};

// ---- プランの状態 -----------------------------------------------------------

/**
 * LMSが自動生成しただけの案を「コーチと合意済み」と見せないための段階。
 * コーチはLMSを操作しないため、confirmed_with_coach は受講生本人が
 * 「コーチと確認しました」と記録することで立つ（コーチの操作ではない）。
 */
export type PlanStatus =
  | 'lms_generated'
  | 'student_reviewed'
  | 'confirmed_with_coach'
  | 'archived';

export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  lms_generated: 'LMSが作成した案',
  student_reviewed: '自分で調整済み（コーチ未確認）',
  confirmed_with_coach: 'コーチと確認済み',
  archived: '過去のロードマップ',
};

// ---- マイルストーン ---------------------------------------------------------

export type MilestoneStatus = 'todo' | 'in_progress' | 'done' | 'missed';

export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  todo: '未着手',
  in_progress: '進行中',
  done: '達成',
  missed: '期限超過',
};

/**
 * 達成状況をLMSが自動判定するための指標。
 * artifact_count / submission_count / application_count は実BFFに対応テーブルが無く
 * （docs/student-outcomes-tracking-requirements.md で優先度B と整理済み）、現状はモック値。
 */
export type MetricKind =
  | 'course_progress'
  | 'artifact_count'
  | 'review_count'
  | 'submission_count'
  | 'application_count'
  | 'self_report';

export const METRIC_KIND_LABEL: Record<MetricKind, string> = {
  course_progress: '教材の完了率',
  artifact_count: '制作物数',
  review_count: 'コーチレビュー回数',
  submission_count: '課題提出数',
  application_count: '案件応募数',
  self_report: '自己申告',
};

export interface MilestoneMetric {
  kind: MetricKind;
  target: number;
  /** LMSが自動集計した実績。self_report のみ受講生の申告値。 */
  current: number;
  unit: string; // '本' '件' '回' '点' '%'
}

/**
 * マイルストーンは必ず「何をするか ＋ どの状態になれば完了か ＋ いつまでに」の3点を持つ。
 * 「バナー制作を練習する」のような判定不能な書き方を型で防ぐのが狙い。
 */
export interface Milestone {
  id: string;
  phaseKey: PhaseKey;
  /** 候補テンプレートから選んだ場合のID。自由記述なら null。 */
  templateId: string | null;
  /** 何をするか（終止形）。例「バナーを3本制作する」 */
  action: string;
  /**
   * action の連用形。例「バナーを3本制作し」。
   * 1文に整形するときに使う。自由記述で作られた場合は null（2行表示にフォールバック）。
   */
  actionRenyou: string | null;
  /** どの状態になれば完了か。例「コーチレビューを2回完了する」 */
  criteria: string;
  dueDate: string; // YYYY-MM-DD
  /** 自動判定できない場合は null。 */
  metric: MilestoneMetric | null;
  status: MilestoneStatus;
  /** 文言を手編集したか。自由記述の混入量を可視化するために持つ。 */
  edited: boolean;
}

// ---- フェーズ（プラン内） ---------------------------------------------------

/** 表示用に日付から導出する状態。保存はしない。 */
export type PhaseProgressStatus = 'done' | 'current' | 'todo';

export interface PlanPhase {
  key: PhaseKey;
  /** 'custom' 以外は PHASE_LABEL と同値。'custom' のみ編集可。 */
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  skills: SkillKey[];
  /** 1 = 最優先。 */
  priority: 1 | 2 | 3;
  milestones: Milestone[];
}

// ---- 初回質問（受講生がセットアップ時に回答する6〜8問） ----------------------

export type WorkStyle = 'side_job' | 'freelance' | 'inhouse' | 'undecided';
export const WORK_STYLE_LABEL: Record<WorkStyle, string> = {
  side_job: '副業として月数万円を稼ぎたい',
  freelance: 'フリーランスとして独立したい',
  inhouse: '制作会社・事業会社に就職／転職したい',
  undecided: 'まだ決めていない',
};

export type ExperienceLevel = 'none' | 'self_taught' | 'some_work';
export const EXPERIENCE_LEVEL_LABEL: Record<ExperienceLevel, string> = {
  none: '完全に未経験',
  self_taught: '独学で少し触ったことがある',
  some_work: '実務・案件の経験がある',
};

export interface IntakeAnswers {
  /** 目指している働き方 */
  workStyle: WorkStyle;
  /** 学びたいスキル（複数可） */
  skills: SkillKey[];
  /** 実現したい期限（月数） */
  deadlineMonths: 3 | 6 | 9 | 12;
  /** 週に使える学習時間（時間） */
  weeklyHours: 2 | 5 | 8 | 12 | 20;
  /** 現在の経験 */
  experience: ExperienceLevel;
  /** 案件獲得まで進みたいか */
  wantsClientWork: boolean;
  /** 特に強化したいこと */
  focus: SkillKey | 'none';
  /** 学習が難しい期間（1-12の月。該当なしは空配列） */
  busyMonths: number[];
}

/**
 * 質問文と選択肢の定義。画面にベタ書きせずAPIから配ることで、
 * 後で実BFFに移すときにフロントを触らずに済むようにする。
 */
export interface ChoiceQuestion {
  id: string;
  title: string;
  help: string;
  kind: 'single' | 'multi';
  options: ChoiceOption[];
}

export interface ChoiceOption {
  value: string | number | boolean;
  label: string;
  note?: string;
}

// ---- 月次チェックイン（次回コーチングの数日前に1分で答える4問） --------------

export type CheckinGoalResult = 'achieved' | 'partial' | 'not_achieved';
export type CheckinHoursChange = 'increased' | 'same' | 'decreased';
export type CheckinBlocker = 'time' | 'difficulty' | 'motivation' | 'unclear' | 'none';
export type CheckinGoalChange = 'none' | 'earlier' | 'later' | 'different';

export const CHECKIN_BLOCKER_LABEL: Record<CheckinBlocker, string> = {
  time: '時間が取れなかった',
  difficulty: '内容が難しかった',
  motivation: 'モチベーションが続かなかった',
  unclear: '何をすればいいか分からなかった',
  none: '特になし',
};

export interface CheckinAnswers {
  /** 今月の目標は達成できましたか？ */
  goalResult: CheckinGoalResult;
  /** 学習時間に変化はありますか？ */
  hoursChange: CheckinHoursChange;
  /** 難しかったことはありますか？（複数可） */
  blockers: CheckinBlocker[];
  /** 目標に変化はありますか？ */
  goalChange: CheckinGoalChange;
}

/** GET /webcoach/learning-plan/{userId}/checkin のレスポンス。 */
export interface CheckinPrompt {
  /** 見直し予定日。plan.nextReviewDate と同値。 */
  dueDate: string; // YYYY-MM-DD
  /** 今回の見直し分に既に回答済みか。 */
  answered: boolean;
  /** dueDate に達していて未回答か（表示判定はこれを使う）。 */
  due: boolean;
  questions: ChoiceQuestion[];
}

// ---- 進捗シグナル（LMSが自動取得する実績） ----------------------------------

export interface ProgressSignals {
  courseProgressPercent: number;
  submissions: number;
  artifacts: number;
  /** 0-100 */
  taskCompletionRate: number;
  applications: number;
  weeklyStudyMinutes: number;
  plannedWeeklyMinutes: number;
}

// ---- 更新案（差分） ---------------------------------------------------------

export type DiffKind =
  | 'shift_phase'
  | 'resize_phase'
  | 'move_milestone_due'
  | 'add_milestone'
  | 'drop_milestone'
  | 'shift_goal_deadline'
  | 'change_priority';

export const DIFF_KIND_LABEL: Record<DiffKind, string> = {
  shift_phase: 'フェーズの後ろ倒し',
  resize_phase: 'フェーズの期間変更',
  move_milestone_due: 'マイルストーン期限の変更',
  add_milestone: 'マイルストーンの追加',
  drop_milestone: 'マイルストーンの削除',
  shift_goal_deadline: '目標期限の変更',
  change_priority: '優先順位の変更',
};

/**
 * 差分を適用したときの結果を機械可読な形で持つ。
 * 表示用の label / before / after とは別に持つのが要点で、
 * 適用時に日本語ラベルを解析しないで済み、かつ画面に見せたプレビューと
 * 実際の適用結果が必ず一致する（差分どうしが二重にかかることもない）。
 */
export type PlanDiffPatch =
  | { type: 'phase_dates'; startDate: string; endDate: string }
  | { type: 'milestone_due'; dueDate: string }
  | { type: 'remove_milestone' }
  | { type: 'goal_deadline'; goalDeadline: string }
  | { type: 'phase_priority'; priority: 1 | 2 | 3 };

export interface PlanDiff {
  id: string;
  kind: DiffKind;
  targetPhaseKey: PhaseKey | null;
  targetMilestoneId: string | null;
  /** 「模擬案件の開始を2週間後ろ倒しする」 */
  label: string;
  /** 「9月1日 〜 9月28日」 */
  before: string;
  /** 「9月15日 〜 10月12日」 */
  after: string;
  /** 適用後の値。各差分は独立して適用され、他の差分に連動しない。 */
  patch: PlanDiffPatch;
  /** 「期間だけ変更」を選んだときに採用される差分か。 */
  isDateOnly: boolean;
  /** 既定 true。チェックを外すとその差分だけ適用しない。 */
  selected: boolean;
}

export type RevisionStatus = 'pending' | 'applied' | 'dismissed' | 'superseded';

export const REVISION_STATUS_LABEL: Record<RevisionStatus, string> = {
  pending: '未確認',
  applied: '反映済み',
  dismissed: '見送り',
  superseded: '新しい更新案に置き換え',
};

/**
 * LMSが作る更新案。コーチが未操作でもロードマップが破綻しないよう、
 * 確定内容を勝手に書き換えず pending のまま蓄積させる。
 */
export interface PlanRevision {
  id: string;
  planId: string;
  userId: number;
  createdAt: string; // ISO8601
  status: RevisionStatus;
  /** 「制作練習が予定より遅れています」 */
  headline: string;
  /** 「模擬案件の開始を2週間後ろ倒しする案を作成しました」 */
  detail: string;
  signals: ProgressSignals;
  /** 受講生がチェックインに未回答なら null（実績シグナルだけで生成した案）。 */
  checkin: CheckinAnswers | null;
  diffs: PlanDiff[];
}

/** 更新案に対する4択。 */
export type RevisionAction = 'apply_all' | 'apply_dates_only' | 'keep_current' | 'apply_selected';

export const REVISION_ACTION_LABEL: Record<RevisionAction, string> = {
  apply_all: '提案どおり更新',
  apply_dates_only: '期間だけ変更',
  keep_current: '現状を維持',
  apply_selected: '選んだ項目だけ更新',
};

// ---- マイルストーン候補テンプレート -----------------------------------------

/**
 * 自由記述を最小化するための候補プール。
 * action（終止形）と actionRenyou（連用形）の両方を持たせることで、
 * 「{期限}までに{連用形}、{完了条件}」の1文を活用変換のヒューリスティック無しに組み立てられる。
 */
export interface MilestoneTemplate {
  id: string;
  phaseKey: PhaseKey;
  /** {n} が defaultTarget に置換される。例「バナーを{n}本制作する」 */
  action: string;
  /** 例「バナーを{n}本制作し」 */
  actionRenyou: string;
  /** 例「コーチレビューを{r}回完了する」。{r} は reviewCount に置換。 */
  criteria: string;
  defaultTarget: number;
  reviewCount: number;
  unit: string;
  metricKind: MetricKind;
  /** このスキルを選んだ受講生に提案する。空配列なら全員に提案。 */
  skills: SkillKey[];
}

// ---- プラン本体 -------------------------------------------------------------

export interface LearningPlan {
  id: string;
  userId: number;
  status: PlanStatus;
  /** 更新のたびに +1。差分適用の履歴確認用。 */
  version: number;

  // ---- 全ロードマップで必須の7項目 ----
  /** 最終ゴール */
  goal: string;
  /** 目標期限 */
  goalDeadline: string; // YYYY-MM-DD
  /** 現在のフェーズ */
  currentPhaseKey: PhaseKey;
  /** 優先スキル */
  prioritySkills: SkillKey[];
  /** 次回見直し日 */
  nextReviewDate: string; // YYYY-MM-DD
  /** 今月のマイルストーンと達成条件はここから導出する */
  phases: PlanPhase[];

  intake: IntakeAnswers;
  /**
   * 「週2時間では3ヶ月での達成は厳しい可能性があります」等の注意書き。
   * 勝手に期限を変えるのではなく、事実として提示するに留める。問題なければ null。
   */
  feasibilityNote: string | null;
  /** 「コーチと確認しました」を記録した時刻。未確認なら null。 */
  confirmedAt: string | null; // ISO8601
  confirmedCoachName: string | null;
  updatedAt: string; // ISO8601
}

/** PATCH /webcoach/learning-plan/{userId} で送る部分更新。 */
export interface LearningPlanPatch {
  goal?: string;
  goalDeadline?: string;
  prioritySkills?: SkillKey[];
  nextReviewDate?: string;
  phases?: PlanPhase[];
  status?: PlanStatus;
}
