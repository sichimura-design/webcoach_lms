/**
 * frontend/src/utils/learningPlanTemplate.ts
 * 学習ロードマップの「LMSが80%作る」部分の実体。
 * ============================================================
 * すべて副作用のない純関数として置く。理由は2つ:
 *   1. MSWモックハンドラと編集UIの両方が同じロジックを使うため。
 *      （UIが「+1週したらどうなるか」をサーバー往復なしに描ける）
 *   2. 実BFFに移すとき、ここをそのままサーバー側に持っていけるため。
 *
 * 生成方針:
 *   - 目標期限は受講生が指定した値を守る（勝手に延ばさない）。
 *   - 「学習が難しい期間」は期限を動かすのではなく、その期間の消化ペースを半分として扱い、
 *     同じ作業量により多くのカレンダー日数を割り当てる。
 *   - 週の学習時間は期間ではなく**スコープ**（マイルストーンの目標値）に効かせる。
 *   - 時間が足りないときは黙って調整せず feasibilityNote として事実を提示する。
 * ============================================================
 */
import {
  CLIENT_WORK_PHASES,
  CheckinAnswers,
  ChoiceQuestion,
  IntakeAnswers,
  LearningPlan,
  Milestone,
  MilestoneTemplate,
  PHASE_LABEL,
  PhaseKey,
  PhaseProgressStatus,
  PlanDiff,
  PlanDiffPatch,
  PlanPhase,
  PlanRevision,
  PlanStage,
  ProgressSignals,
  STAGE_LABEL,
  STAGE_NOTE,
  STAGE_OF_PHASE,
  STAGE_ORDER,
  STANDARD_PHASE_ORDER,
  SKILL_LABEL,
  SkillKey,
  WORK_STYLE_LABEL,
} from '../types/learningPlan';

// ============================================================
// 日付ユーティリティ（既存の utils/dateFormatting.ts は Unix 秒が対象なので別に持つ）
// ============================================================

/** Date → 'YYYY-MM-DD'（ローカルタイム基準。toISOString はUTCずれを起こすので使わない） */
export function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 'YYYY-MM-DD' → Date（時刻は 00:00 ローカル） */
export function parseIso(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

export function addMonths(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setMonth(d.getMonth() + n);
  return toIso(d);
}

/** a → b の日数（b が後なら正） */
export function diffDays(a: string, b: string): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86400000);
}

/** '2026-08-31' → '8月31日' */
export function formatJpDate(iso: string): string {
  const d = parseIso(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** '2026-08-31' → '2026年8月31日' */
export function formatJpDateFull(iso: string): string {
  return `${parseIso(iso).getFullYear()}年${formatJpDate(iso)}`;
}

/** '2026-08-31' → '2026-08'（同月判定用） */
function yearMonth(iso: string): string {
  return iso.slice(0, 7);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

let idSeq = 0;
function newId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${idSeq}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

// ============================================================
// 初回質問（6〜8問）
// ============================================================

export const INTAKE_QUESTIONS: ChoiceQuestion[] = [
  {
    id: 'workStyle',
    title: '目指している働き方を教えてください',
    help: 'いちばん近いものを1つ選んでください。あとから変えられます。',
    kind: 'single',
    options: (Object.keys(WORK_STYLE_LABEL) as (keyof typeof WORK_STYLE_LABEL)[]).map((k) => ({
      value: k,
      label: WORK_STYLE_LABEL[k],
    })),
  },
  {
    id: 'skills',
    title: '学びたいスキルはどれですか？',
    help: '複数選べます。選んだスキルに合わせてロードマップの中身が変わります。',
    kind: 'multi',
    options: (Object.keys(SKILL_LABEL) as SkillKey[]).map((k) => ({ value: k, label: SKILL_LABEL[k] })),
  },
  {
    id: 'deadlineMonths',
    title: 'いつまでに実現したいですか？',
    help: 'この期限を守る形でロードマップを組みます。',
    kind: 'single',
    options: [
      { value: 3, label: '3ヶ月後', note: 'かなり集中的に進めるプランになります' },
      { value: 6, label: '6ヶ月後', note: 'いちばん選ばれている期間です' },
      { value: 9, label: '9ヶ月後' },
      { value: 12, label: '1年後', note: '仕事や学業と両立しやすい配分です' },
    ],
  },
  {
    id: 'weeklyHours',
    title: '週にどれくらい学習時間を使えますか？',
    help: '無理のない範囲で。時間に合わせて1回あたりの課題量を調整します。',
    kind: 'single',
    options: [
      { value: 2, label: '週2時間くらい' },
      { value: 5, label: '週5時間くらい' },
      { value: 8, label: '週8時間くらい', note: '平日1時間＋週末3時間ほど' },
      { value: 12, label: '週12時間くらい' },
      { value: 20, label: '週20時間以上' },
    ],
  },
  {
    id: 'experience',
    title: '現在の経験を教えてください',
    help: '経験がある方は基礎フェーズを短くします。',
    kind: 'single',
    options: [
      { value: 'none', label: '完全に未経験' },
      { value: 'self_taught', label: '独学で少し触ったことがある' },
      { value: 'some_work', label: '実務・案件の経験がある' },
    ],
  },
  {
    id: 'wantsClientWork',
    title: '案件獲得まで進みたいですか？',
    help: '「まずはスキル習得から」を選ぶと、案件獲得フェーズを外した構成になります。',
    kind: 'single',
    options: [
      { value: true, label: '案件獲得まで進みたい' },
      { value: false, label: 'まずはスキル習得に集中したい' },
    ],
  },
  {
    id: 'focus',
    title: '特に強化したいことはありますか？',
    help: 'そのスキルのフェーズを長めに取ります。',
    kind: 'single',
    options: [
      { value: 'none', label: '特にない・バランスよく' },
      ...(Object.keys(SKILL_LABEL) as SkillKey[]).map((k) => ({ value: k, label: SKILL_LABEL[k] })),
    ],
  },
  {
    id: 'busyMonths',
    title: '学習が難しくなりそうな時期はありますか？',
    help: '複数選べます。その時期はペースを落とした計画にします。',
    kind: 'multi',
    options: Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}月` })),
  },
];

// ============================================================
// 月次チェックイン（1分で終わる4問）
// ============================================================

export const CHECKIN_QUESTIONS: ChoiceQuestion[] = [
  {
    id: 'goalResult',
    title: '今月の目標は達成できましたか？',
    help: '',
    kind: 'single',
    options: [
      { value: 'achieved', label: '達成できた' },
      { value: 'partial', label: '一部できた' },
      { value: 'not_achieved', label: 'あまり進まなかった' },
    ],
  },
  {
    id: 'hoursChange',
    title: '学習時間に変化はありますか？',
    help: '',
    kind: 'single',
    options: [
      { value: 'increased', label: '増えた' },
      { value: 'same', label: '変わらない' },
      { value: 'decreased', label: '減った' },
    ],
  },
  {
    id: 'blockers',
    title: '難しかったことはありますか？',
    help: '複数選べます。',
    kind: 'multi',
    options: [
      { value: 'time', label: '時間が取れなかった' },
      { value: 'difficulty', label: '内容が難しかった' },
      { value: 'motivation', label: 'モチベーションが続かなかった' },
      { value: 'unclear', label: '何をすればいいか分からなかった' },
      { value: 'none', label: '特になし' },
    ],
  },
  {
    id: 'goalChange',
    title: '目標に変化はありますか？',
    help: '',
    kind: 'single',
    options: [
      { value: 'none', label: '変わらない' },
      { value: 'earlier', label: 'もっと早く達成したい' },
      { value: 'later', label: '期限を後ろに倒したい' },
      { value: 'different', label: '目指す方向が変わった' },
    ],
  },
];

// ============================================================
// マイルストーン候補テンプレート
// ============================================================

/**
 * {n} は目標値、{r} はレビュー回数に置換される。
 * skills が空配列のテンプレートは、選択スキルに関わらず全員に提案する。
 */
export const MILESTONE_TEMPLATES: MilestoneTemplate[] = [
  // 基礎・座学
  {
    id: 'tpl-foundation-principles',
    phaseKey: 'foundation',
    action: '基礎コースを完了する',
    actionRenyou: '基礎コースを完了し',
    criteria: 'デザインの4大原則を自分の言葉で説明できる状態にする',
    defaultTarget: 100, reviewCount: 1, unit: '%', metricKind: 'course_progress', skills: [],
  },
  {
    id: 'tpl-foundation-color',
    phaseKey: 'foundation',
    action: '配色の基本を学ぶ',
    actionRenyou: '配色の基本を学び',
    criteria: '既存サイトの配色を{n}件分析してメモに残す',
    defaultTarget: 3, reviewCount: 1, unit: '件', metricKind: 'artifact_count', skills: ['design_basics', 'banner', 'lp'],
  },
  // ツール学習
  {
    id: 'tpl-tools-figma',
    phaseKey: 'tools',
    action: 'デザインツールで作例を模写する',
    actionRenyou: 'デザインツールで作例を模写し',
    criteria: '模写を{n}本提出してコーチレビューを{r}回完了する',
    defaultTarget: 3, reviewCount: 1, unit: '本', metricKind: 'artifact_count', skills: ['design_basics', 'banner', 'lp', 'ui_ux'],
  },
  {
    id: 'tpl-tools-coding-env',
    phaseKey: 'tools',
    action: '開発環境を整えて静的ページを公開する',
    actionRenyou: '開発環境を整えて静的ページを公開し',
    criteria: '公開URLをコーチに共有する',
    defaultTarget: 1, reviewCount: 1, unit: '件', metricKind: 'artifact_count', skills: ['coding', 'wordpress'],
  },
  // 制作練習
  {
    id: 'tpl-practice-banner',
    phaseKey: 'practice',
    action: 'バナーを{n}本制作する',
    actionRenyou: 'バナーを{n}本制作し',
    criteria: 'コーチレビューを{r}回完了する',
    defaultTarget: 3, reviewCount: 2, unit: '本', metricKind: 'artifact_count', skills: ['banner', 'design_basics'],
  },
  {
    id: 'tpl-practice-lp',
    phaseKey: 'practice',
    action: 'LPのファーストビューを{n}本制作する',
    actionRenyou: 'LPのファーストビューを{n}本制作し',
    criteria: 'コーチレビューを{r}回完了する',
    defaultTarget: 2, reviewCount: 1, unit: '本', metricKind: 'artifact_count', skills: ['lp', 'design_basics'],
  },
  {
    id: 'tpl-practice-coding',
    phaseKey: 'practice',
    action: 'デザインカンプを{n}件コーディングする',
    actionRenyou: 'デザインカンプを{n}件コーディングし',
    criteria: 'スマホ表示の崩れがない状態まで仕上げる',
    defaultTarget: 2, reviewCount: 1, unit: '件', metricKind: 'artifact_count', skills: ['coding', 'wordpress'],
  },
  {
    id: 'tpl-practice-video',
    phaseKey: 'practice',
    action: 'ショート動画を{n}本編集する',
    actionRenyou: 'ショート動画を{n}本編集し',
    criteria: 'コーチレビューを{r}回完了する',
    defaultTarget: 3, reviewCount: 1, unit: '本', metricKind: 'artifact_count', skills: ['video'],
  },
  // 模擬案件
  {
    id: 'tpl-mock-brief',
    phaseKey: 'mock_project',
    action: '模擬案件に取り組む',
    actionRenyou: '模擬案件に取り組み',
    criteria: '{n}件をヒアリングシート付きで提出する',
    defaultTarget: 2, reviewCount: 1, unit: '件', metricKind: 'submission_count', skills: [],
  },
  {
    id: 'tpl-mock-revise',
    phaseKey: 'mock_project',
    action: 'フィードバックをもとに修正する',
    actionRenyou: 'フィードバックをもとに修正し',
    criteria: '修正版を{n}件提出する',
    defaultTarget: 2, reviewCount: 1, unit: '件', metricKind: 'submission_count', skills: [],
  },
  // ポートフォリオ
  {
    id: 'tpl-portfolio-site',
    phaseKey: 'portfolio',
    action: 'ポートフォリオサイトを公開する',
    actionRenyou: 'ポートフォリオサイトを公開し',
    criteria: '作品を{n}点掲載してコーチレビューを{r}回完了する',
    defaultTarget: 5, reviewCount: 1, unit: '点', metricKind: 'artifact_count', skills: [],
  },
  {
    id: 'tpl-portfolio-profile',
    phaseKey: 'portfolio',
    action: '自己紹介文と実績サマリを用意する',
    actionRenyou: '自己紹介文と実績サマリを用意し',
    criteria: 'コーチレビューを{r}回完了する',
    defaultTarget: 1, reviewCount: 1, unit: '件', metricKind: 'review_count', skills: [],
  },
  // 案件獲得
  {
    id: 'tpl-job-apply',
    phaseKey: 'job_hunting',
    action: 'クラウドソーシングで案件に応募する',
    actionRenyou: 'クラウドソーシングで案件に応募し',
    criteria: '{n}件応募して提案文をコーチに共有する',
    defaultTarget: 10, reviewCount: 1, unit: '件', metricKind: 'application_count', skills: [],
  },
  {
    id: 'tpl-job-proposal',
    phaseKey: 'job_hunting',
    action: '提案文のテンプレートを作る',
    actionRenyou: '提案文のテンプレートを作り',
    criteria: 'コーチレビューを{r}回完了する',
    defaultTarget: 1, reviewCount: 1, unit: '件', metricKind: 'review_count', skills: [],
  },
  // 実案件
  {
    id: 'tpl-client-first',
    phaseKey: 'client_work',
    action: '初案件を納品する',
    actionRenyou: '初案件を納品し',
    criteria: '報酬の受け取りまで完了する',
    defaultTarget: 1, reviewCount: 1, unit: '件', metricKind: 'self_report', skills: [],
  },
  {
    id: 'tpl-client-repeat',
    phaseKey: 'client_work',
    action: '継続案件の相談をする',
    actionRenyou: '継続案件の相談をし',
    criteria: '{n}件のクライアントに次回提案を送る',
    defaultTarget: 2, reviewCount: 1, unit: '件', metricKind: 'application_count', skills: [],
  },
];

// ============================================================
// フェーズ配分
// ============================================================

/** 6ヶ月・未経験・案件獲得ありを26週としたときの基準週数。相対比としてのみ使う。 */
const BASE_WEEKS: Record<PhaseKey, number> = {
  foundation: 3,
  tools: 3,
  practice: 6,
  mock_project: 4,
  portfolio: 4,
  job_hunting: 4,
  client_work: 2,
  custom: 2,
};

/** 経験に応じて基礎寄りのフェーズを圧縮する係数。 */
const EXPERIENCE_MULTIPLIER: Record<IntakeAnswers['experience'], Partial<Record<PhaseKey, number>>> = {
  none: {},
  self_taught: { foundation: 0.5, tools: 0.7 },
  some_work: { foundation: 0.25, tools: 0.5, practice: 0.7 },
};

/** そのフェーズを終えるのに要するおおよその総学習時間。feasibility 判定にのみ使う。 */
const BASE_HOURS: Record<PhaseKey, number> = {
  foundation: 30,
  tools: 30,
  practice: 70,
  mock_project: 50,
  portfolio: 50,
  job_hunting: 40,
  client_work: 30,
  custom: 20,
};

/** 各フェーズの既定の学習スキル。受講生の選択スキルと交差させる。 */
const PHASE_SKILLS: Record<PhaseKey, SkillKey[]> = {
  foundation: ['design_basics'],
  tools: ['design_basics', 'coding'],
  practice: ['banner', 'lp', 'coding', 'video'],
  mock_project: ['banner', 'lp', 'coding'],
  portfolio: ['design_basics', 'ui_ux'],
  job_hunting: ['marketing'],
  client_work: ['marketing'],
  custom: [],
};

// ============================================================
// 生成
// ============================================================

function activePhaseKeys(a: IntakeAnswers): PhaseKey[] {
  return STANDARD_PHASE_ORDER.filter((k) => a.wantsClientWork || !CLIENT_WORK_PHASES.includes(k));
}

function phaseWeights(a: IntakeAnswers): Record<string, number> {
  const mult = EXPERIENCE_MULTIPLIER[a.experience];
  const weights: Record<string, number> = {};
  activePhaseKeys(a).forEach((k) => {
    let w = BASE_WEEKS[k] * (mult[k] ?? 1);
    // 「特に強化したいこと」に対応するフェーズを 1.3 倍にする
    if (a.focus !== 'none' && PHASE_SKILLS[k].includes(a.focus)) w *= 1.3;
    weights[k] = w;
  });
  return weights;
}

/**
 * 「学習が難しい期間」を織り込んだ日ごとの消化ペース。
 * 期限は動かさず、難しい月は同じ作業量により多くのカレンダー日数を割り当てる。
 */
function dayCapacity(d: Date, busyMonths: number[]): number {
  return busyMonths.includes(d.getMonth() + 1) ? 0.5 : 1;
}

/** 開始日から終了日まで日ごとの累積キャパシティを作る。 */
function capacityCurve(startIso: string, endIso: string, busyMonths: number[]): number[] {
  const total = Math.max(1, diffDays(startIso, endIso));
  const curve: number[] = [0];
  const cursor = parseIso(startIso);
  let acc = 0;
  for (let i = 0; i < total; i += 1) {
    acc += dayCapacity(cursor, busyMonths);
    curve.push(acc);
    cursor.setDate(cursor.getDate() + 1);
  }
  return curve;
}

/** 累積キャパシティ curve のうち threshold を最初に超える日オフセットを返す。 */
function offsetForCapacity(curve: number[], threshold: number): number {
  for (let i = 0; i < curve.length; i += 1) {
    if (curve[i] >= threshold) return i;
  }
  return curve.length - 1;
}

function buildMilestone(
  tpl: MilestoneTemplate,
  target: number,
  dueDate: string,
): Milestone {
  const fill = (s: string) => s.replace(/\{n\}/g, String(target)).replace(/\{r\}/g, String(tpl.reviewCount));
  return {
    id: newId('ms'),
    phaseKey: tpl.phaseKey,
    templateId: tpl.id,
    action: fill(tpl.action),
    actionRenyou: fill(tpl.actionRenyou),
    criteria: fill(tpl.criteria),
    dueDate,
    metric:
      tpl.metricKind === 'self_report'
        ? null
        : { kind: tpl.metricKind, target, current: 0, unit: tpl.unit },
    status: 'todo',
    edited: false,
  };
}

/** 候補テンプレートのうち、受講生の選択スキルに合うものを返す。 */
export function templatesForPhase(phaseKey: PhaseKey, skills: SkillKey[]): MilestoneTemplate[] {
  return MILESTONE_TEMPLATES.filter(
    (t) => t.phaseKey === phaseKey && (t.skills.length === 0 || t.skills.some((s) => skills.includes(s))),
  );
}

/** 週の学習時間から目標値のスケールを決める。期間ではなくスコープに効かせる。 */
function targetScale(weeklyHours: number): number {
  return clamp(weeklyHours / 8, 0.5, 2);
}

/**
 * 初回質問の回答から標準ロードマップを生成する。
 * 「初期状態で80%完成している」ことがこの関数の役目。
 */
export function generateLearningPlan(userId: number, a: IntakeAnswers, today: Date): LearningPlan {
  const startIso = toIso(today);
  const goalDeadline = addMonths(startIso, a.deadlineMonths);
  const keys = activePhaseKeys(a);
  const weights = phaseWeights(a);
  const totalWeight = keys.reduce((s, k) => s + weights[k], 0);

  const curve = capacityCurve(startIso, goalDeadline, a.busyMonths);
  const totalCapacity = curve[curve.length - 1];
  const scale = targetScale(a.weeklyHours);

  const phases: PlanPhase[] = [];
  let consumed = 0;
  keys.forEach((key, i) => {
    const share = (weights[key] / totalWeight) * totalCapacity;
    const startOffset = offsetForCapacity(curve, consumed);
    consumed += share;
    // 最後のフェーズは必ず目標期限で終える（丸め誤差を吸収する）
    const endOffset = i === keys.length - 1 ? curve.length - 1 : offsetForCapacity(curve, consumed);
    const phaseStart = addDays(startIso, startOffset);
    const phaseEnd = addDays(startIso, Math.max(endOffset, startOffset + 6));

    const candidates = templatesForPhase(key, a.skills);
    const chosen = candidates.slice(0, 2);
    const milestones = chosen.map((tpl, mi) => {
      const target = Math.max(1, Math.round(tpl.defaultTarget * (tpl.unit === '%' ? 1 : scale)));
      // 2件あるときは1件目をフェーズの6割地点、2件目を終了日に置く
      const due =
        chosen.length > 1 && mi === 0
          ? addDays(phaseStart, Math.round(diffDays(phaseStart, phaseEnd) * 0.6))
          : phaseEnd;
      return buildMilestone(tpl, target, due);
    });

    phases.push({
      key,
      title: PHASE_LABEL[key],
      startDate: phaseStart,
      endDate: phaseEnd,
      skills: PHASE_SKILLS[key].filter((s) => a.skills.includes(s)),
      priority: i < 2 ? 1 : i < 4 ? 2 : 3,
      milestones,
    });
  });

  const plan: LearningPlan = {
    id: newId('plan'),
    userId,
    status: 'lms_generated',
    version: 1,
    goal: buildGoalSentence(a),
    goalDeadline,
    currentPhaseKey: phases[0]?.key ?? 'foundation',
    prioritySkills: a.focus !== 'none' ? [a.focus, ...a.skills.filter((s) => s !== a.focus)].slice(0, 3) : a.skills.slice(0, 3),
    nextReviewDate: nextReviewFrom(startIso, goalDeadline),
    phases,
    intake: a,
    feasibilityNote: feasibilityNote(a, keys),
    confirmedAt: null,
    confirmedCoachName: null,
    updatedAt: new Date().toISOString(),
  };

  plan.currentPhaseKey = phases[currentPhaseIndex(plan, today)]?.key ?? plan.currentPhaseKey;
  return plan;
}

function buildGoalSentence(a: IntakeAnswers): string {
  const skill = a.focus !== 'none' ? SKILL_LABEL[a.focus] : a.skills[0] ? SKILL_LABEL[a.skills[0]] : 'Webデザイン';
  const months = `${a.deadlineMonths}ヶ月後`;
  if (!a.wantsClientWork) return `${months}までに${skill}を実務レベルで扱えるようになる`;
  switch (a.workStyle) {
    case 'side_job':
      return `${months}までに${skill}の副業案件を獲得する`;
    case 'freelance':
      return `${months}までに${skill}でフリーランスとして初案件を獲得する`;
    case 'inhouse':
      return `${months}までに${skill}のスキルで制作会社への応募を開始する`;
    default:
      return `${months}までに${skill}で初案件を獲得する`;
  }
}

function feasibilityNote(a: IntakeAnswers, keys: PhaseKey[]): string | null {
  const mult = EXPERIENCE_MULTIPLIER[a.experience];
  const needed = keys.reduce((s, k) => s + BASE_HOURS[k] * (mult[k] ?? 1), 0);
  const weeks = a.deadlineMonths * 4.345;
  const available = a.weeklyHours * weeks;
  // 0.6 は「推奨構成（週8h×6ヶ月）では出さず、明らかに足りない組み合わせでだけ出す」水準。
  // 少しの不足で毎回警告を出すと読み飛ばされ、本当に無理な計画を止められなくなる。
  if (available >= needed * 0.6) return null;
  return (
    `この内容には約${Math.round(needed)}時間が目安ですが、週${a.weeklyHours}時間×${a.deadlineMonths}ヶ月では約${Math.round(available)}時間です。` +
    'コーチと相談のうえ、期限を延ばす・学習時間を増やす・フェーズを絞る、のいずれかを検討しましょう。'
  );
}

/** 次回見直し日は1ヶ月後。ただし目標期限は超えない。 */
function nextReviewFrom(fromIso: string, goalDeadline: string): string {
  const oneMonth = addMonths(fromIso, 1);
  return diffDays(oneMonth, goalDeadline) < 0 ? goalDeadline : oneMonth;
}

// ============================================================
// 導出（表示用。保存はしない）
// ============================================================

/** 今日が属するフェーズの index。期間前なら0、期間後なら最終 index。 */
export function currentPhaseIndex(plan: LearningPlan, today: Date): number {
  const iso = toIso(today);
  const idx = plan.phases.findIndex((p) => diffDays(p.startDate, iso) >= 0 && diffDays(iso, p.endDate) >= 0);
  if (idx >= 0) return idx;
  if (plan.phases.length && diffDays(iso, plan.phases[0].startDate) > 0) return 0;
  return Math.max(0, plan.phases.length - 1);
}

/** plan.phases と同じ並びの状態配列を返す。 */
export function derivePhaseStatus(plan: LearningPlan, today: Date): PhaseProgressStatus[] {
  const current = currentPhaseIndex(plan, today);
  return plan.phases.map((_, i) => (i < current ? 'done' : i === current ? 'current' : 'todo'));
}

/**
 * 表示用に7フェーズを4ステージへ束ねる。フェーズが1つも無いステージは返さない
 * （「案件獲得まで進まない」受講生に空の『挑戦』を見せない）。
 */
export function deriveStages(plan: LearningPlan, today: Date): PlanStage[] {
  const statuses = derivePhaseStatus(plan, today);
  const currentIdx = currentPhaseIndex(plan, today);
  const currentStageKey = STAGE_OF_PHASE[plan.phases[currentIdx]?.key ?? 'foundation'];

  const present = STAGE_ORDER.filter((key) => plan.phases.some((p) => STAGE_OF_PHASE[p.key] === key));
  const currentPos = present.indexOf(currentStageKey);

  return present.map((key, pos) => {
    const phases = plan.phases.filter((p) => STAGE_OF_PHASE[p.key] === key);
    const phaseStatuses = plan.phases
      .map((p, i) => ({ p, s: statuses[i] }))
      .filter(({ p }) => STAGE_OF_PHASE[p.key] === key)
      .map(({ s }) => s);

    return {
      key,
      title: STAGE_LABEL[key],
      note: STAGE_NOTE[key],
      startDate: phases[0].startDate,
      endDate: phases[phases.length - 1].endDate,
      status: pos < currentPos ? 'done' : pos === currentPos ? 'current' : 'todo',
      phases,
      phaseStatuses,
    };
  });
}

// ---- マイページの帯用: 5ステップ表示 ---------------------------------------

/**
 * マイページのロードマップ帯に出す1ステップ。
 * 保存はしない表示専用の型で、PlanStage とは別物。
 */
export interface RoadmapStepView {
  key: string;
  title: string;
  description: string;
  status: PhaseProgressStatus;
  /** 最後のステップ（ゴール）か。バッジと色が変わる */
  isGoal: boolean;
}

/**
 * マイページの帯が使う5ステップの定義。
 * ============================================================
 * 【なぜ deriveStages（4ステージ）と別に持つのか】
 * /learning-plan の StageRail は「基礎・実践・準備・挑戦」の4つに束ね、
 * 内訳を現在ステージの中だけ開く（types/learningPlan.ts の設計理由を参照）。
 * マイページの帯は内訳を開かない代わりに、ゴールまでの道のりが一目で分かるよう
 * 7フェーズを1:1で割った5つを並べる。粒度が違うのは意図的で、
 * STAGE_LABEL / STAGE_ORDER には手を入れない（あちらの表示を変えないため）。
 *
 * 文言はJSXにベタ書きせず、ここを唯一の出どころにする。
 * ============================================================
 */
const ROADMAP_STEPS: { key: string; title: string; description: string; phases: PhaseKey[] }[] = [
  { key: 'basic',       title: '基礎',           description: 'ツールとデザインの基本を学ぶ',       phases: ['foundation', 'tools'] },
  { key: 'creation',    title: '制作',           description: '制作に慣れ、クオリティを上げる',     phases: ['practice', 'mock_project', 'custom'] },
  { key: 'portfolio',   title: 'ポートフォリオ', description: '自信を持って見せられる作品を増やす', phases: ['portfolio'] },
  { key: 'preparation', title: '応募準備',       description: 'ポートフォリオを整えて提案の準備をする', phases: ['job_hunting'] },
  { key: 'first-job',   title: '初案件獲得',     description: '実案件に挑戦して最初の実績へ',       phases: ['client_work'] },
];

/**
 * マイページのロードマップ帯に並べる5ステップを組む。
 * フェーズが1つも無いステップは落とす（案件獲得まで進まない受講生に空の枠を見せない）。
 * そのため返る件数は 5 とは限らない。描画側は件数可変で組むこと。
 */
export function deriveRoadmapSteps(plan: LearningPlan, today: Date): RoadmapStepView[] {
  const statuses = derivePhaseStatus(plan, today);
  const byKey = new Map<PhaseKey, PhaseProgressStatus[]>();
  plan.phases.forEach((p, i) => {
    const list = byKey.get(p.key) ?? [];
    list.push(statuses[i]);
    byKey.set(p.key, list);
  });

  const present = ROADMAP_STEPS.filter((s) => s.phases.some((k) => byKey.has(k)));
  // current は1つだけ。現在フェーズを含むステップより手前を done、後ろを todo にする
  const currentPos = present.findIndex((s) =>
    s.phases.some((k) => (byKey.get(k) ?? []).includes('current'))
  );

  return present.map((s, pos) => ({
    key: s.key,
    title: s.title,
    description: s.description,
    status:
      currentPos < 0
        ? 'todo'
        : pos < currentPos
          ? 'done'
          : pos === currentPos
            ? 'current'
            : 'todo',
    isGoal: pos === present.length - 1,
  }));
}

/**
 * ロードマップ全体の進捗 0-1。
 * 完了フェーズを1、現在フェーズをマイルストーン平均で数える。
 * フェーズ単位の「4/14件」ではなく全体1本の割合にすることで、
 * 個々の遅れが実態以上に大きく見えるのを避ける。
 */
export function planProgress(plan: LearningPlan, today: Date): number {
  const n = plan.phases.length;
  if (n === 0) return 0;
  const current = currentPhaseIndex(plan, today);
  const phase = plan.phases[current];
  const inPhase = phase && phase.milestones.length
    ? phase.milestones.reduce((s, m) => s + milestoneProgress(m), 0) / phase.milestones.length
    : 0;
  return clamp((current + inPhase) / n, 0, 1);
}

/**
 * 今月が期限のマイルストーン。該当が無ければ直近の未完了マイルストーンを最大 limit 件返す
 * （「今月のマイルストーン」が空欄になって必須項目が欠けるのを避ける）。
 */
export function currentMonthMilestones(plan: LearningPlan, today: Date, limit = 3): Milestone[] {
  const all = plan.phases.flatMap((p) => p.milestones);
  const ym = yearMonth(toIso(today));
  const thisMonth = all.filter((m) => yearMonth(m.dueDate) === ym);
  if (thisMonth.length) return thisMonth.slice(0, limit);
  const iso = toIso(today);
  return all
    .filter((m) => m.status !== 'done' && diffDays(iso, m.dueDate) >= 0)
    .sort((x, y) => x.dueDate.localeCompare(y.dueDate))
    .slice(0, limit);
}

/**
 * 「いつまでに ＋ 何をするか ＋ どの状態になれば完了か」の1文に整形する。
 * 自由記述で連用形が無い場合は 2 文に分けて返す（誤った活用を作らない）。
 */
export function formatMilestone(m: Milestone): string {
  const due = formatJpDate(m.dueDate);
  if (m.actionRenyou) return `${due}までに${m.actionRenyou}、${m.criteria}`;
  return `${due}までに${m.action}（完了条件: ${m.criteria}）`;
}

/** マイルストーンの達成率 0-1。metric が無い場合は status から導出。 */
export function milestoneProgress(m: Milestone): number {
  if (!m.metric) return m.status === 'done' ? 1 : 0;
  if (m.metric.target <= 0) return 0;
  return clamp(m.metric.current / m.metric.target, 0, 1);
}

// ============================================================
// 編集（期間調整）
// ============================================================

const MIN_PHASE_DAYS = 7;

function withUpdated(plan: LearningPlan, phases: PlanPhase[], today: Date): LearningPlan {
  const next: LearningPlan = { ...plan, phases, updatedAt: new Date().toISOString() };
  const last = phases[phases.length - 1];
  if (last && diffDays(next.goalDeadline, last.endDate) > 0) next.goalDeadline = last.endDate;
  next.currentPhaseKey = phases[currentPhaseIndex(next, today)]?.key ?? next.currentPhaseKey;
  return next;
}

/**
 * 対象フェーズの期間を deltaDays だけ伸縮し、以降のフェーズを同じ幅だけ連動シフトする。
 * 「このフェーズを2週間延ばす」という操作をそのまま表す。
 */
export function shiftPhase(plan: LearningPlan, phaseKey: PhaseKey, deltaDays: number, today: Date): LearningPlan {
  const idx = plan.phases.findIndex((p) => p.key === phaseKey);
  if (idx < 0) return plan;

  const target = plan.phases[idx];
  const currentLength = diffDays(target.startDate, target.endDate);
  const applied = Math.max(deltaDays, MIN_PHASE_DAYS - currentLength);
  if (applied === 0) return plan;

  const phases = plan.phases.map((p, i) => {
    if (i < idx) return p;
    if (i === idx) return shiftMilestones({ ...p, endDate: addDays(p.endDate, applied) }, applied);
    return shiftMilestones(
      { ...p, startDate: addDays(p.startDate, applied), endDate: addDays(p.endDate, applied) },
      applied,
    );
  });
  return withUpdated(plan, phases, today);
}

/** フェーズ内のマイルストーン期限も一緒に動かす（期限だけ取り残されるのを防ぐ）。 */
function shiftMilestones(phase: PlanPhase, deltaDays: number): PlanPhase {
  return {
    ...phase,
    milestones: phase.milestones.map((m) => ({
      ...m,
      // フェーズ末尾を超えないよう丸める
      dueDate: minIso(addDays(m.dueDate, deltaDays), phase.endDate),
    })),
  };
}

function minIso(a: string, b: string): string {
  return diffDays(a, b) >= 0 ? a : b;
}

function maxIso(a: string, b: string): string {
  return diffDays(a, b) >= 0 ? b : a;
}

/** 日付入力で開始・終了を直接指定する。以降のフェーズは終了日の変化分だけ連動シフトする。 */
export function setPhaseDates(
  plan: LearningPlan,
  phaseKey: PhaseKey,
  startDate: string,
  endDate: string,
  today: Date,
): LearningPlan {
  const idx = plan.phases.findIndex((p) => p.key === phaseKey);
  if (idx < 0) return plan;
  const target = plan.phases[idx];
  const safeEnd = diffDays(startDate, endDate) < MIN_PHASE_DAYS ? addDays(startDate, MIN_PHASE_DAYS) : endDate;
  const tailShift = diffDays(target.endDate, safeEnd);

  const phases = plan.phases.map((p, i) => {
    if (i < idx) return p;
    if (i === idx) return shiftMilestones({ ...p, startDate, endDate: safeEnd }, 0);
    return shiftMilestones(
      { ...p, startDate: addDays(p.startDate, tailShift), endDate: addDays(p.endDate, tailShift) },
      tailShift,
    );
  });
  return withUpdated(plan, phases, today);
}

// ============================================================
// 編集（目標期限を動かしてペースを変える）
// ============================================================

/**
 * 残りの全フェーズを比例で伸縮できる下限。
 * 「案件獲得まで1週間」のような無意味な計画を作らせないための床。
 */
export function minGoalDeadline(plan: LearningPlan, today: Date): string {
  const anchor = rescaleAnchor(plan, today);
  const remaining = plan.phases.filter((p) => diffDays(anchor, p.endDate) > 0).length;
  return addDays(anchor, Math.max(MIN_PHASE_DAYS, remaining * MIN_PHASE_DAYS));
}

/** 伸縮の起点。まだ始まっていない計画は開始日を、進行中の計画は今日を基準にする。 */
function rescaleAnchor(plan: LearningPlan, today: Date): string {
  const iso = toIso(today);
  const first = plan.phases[0]?.startDate;
  if (first && diffDays(iso, first) > 0) return first;
  return iso;
}

/**
 * 目標期限を動かし、**残りのフェーズだけ**を比例で伸縮する。
 *
 * 学ぶ内容（フェーズ構成もマイルストーンも）は一切変えず、カレンダー上の長さだけを変える。
 * 「ペースを調整する」という操作をそのまま表すのが狙い。
 * 済んだ期間まで動かすと履歴が書き換わってしまうので、起点より前のフェーズは触らない。
 */
export function setGoalDeadline(plan: LearningPlan, goalDeadline: string, today: Date): LearningPlan {
  const anchor = rescaleAnchor(plan, today);
  const lastEnd = plan.phases[plan.phases.length - 1]?.endDate;
  if (!lastEnd) return plan;

  const floor = minGoalDeadline(plan, today);
  const target = diffDays(goalDeadline, floor) > 0 ? floor : goalDeadline;

  const oldSpan = diffDays(anchor, lastEnd);
  const newSpan = diffDays(anchor, target);
  if (oldSpan <= 0 || newSpan <= 0) return plan;

  const scale = (iso: string): string => {
    const offset = diffDays(anchor, iso);
    if (offset <= 0) return iso; // 起点より前＝済んだ日付は動かさない
    return addDays(anchor, Math.round((offset * newSpan) / oldSpan));
  };

  // 順に確定させる。比例縮小で 7 日を割り込んだフェーズだけ床まで押し戻し、
  // その分を後続の開始日にも反映させることで、期間の逆転と重なりを防ぐ。
  let prevEnd: string | null = null;
  const phases = plan.phases.map((p) => {
    if (diffDays(anchor, p.endDate) <= 0) {
      prevEnd = p.endDate;
      return p;
    }
    let startDate = scale(p.startDate);
    if (prevEnd && diffDays(prevEnd, startDate) < 0) startDate = prevEnd;
    let endDate = scale(p.endDate);
    if (diffDays(startDate, endDate) < MIN_PHASE_DAYS) endDate = addDays(startDate, MIN_PHASE_DAYS);
    prevEnd = endDate;

    return {
      ...p,
      startDate,
      endDate,
      // 期限だけ取り残されないよう、マイルストーンも同じ比率で動かしてフェーズ内に丸める
      milestones: p.milestones.map((m) => {
        const due = scale(m.dueDate);
        if (diffDays(due, startDate) > 0) return { ...m, dueDate: startDate };
        return { ...m, dueDate: minIso(due, endDate) };
      }),
    };
  });

  const next: LearningPlan = {
    ...plan,
    phases,
    goalDeadline: maxIso(target, phases[phases.length - 1].endDate),
    updatedAt: new Date().toISOString(),
  };
  next.currentPhaseKey = phases[currentPhaseIndex(next, today)]?.key ?? next.currentPhaseKey;
  return next;
}

/**
 * 残り期間から逆算した「週あたりの目安時間」。
 * 期限を延ばすと週の負担が減る、という交換条件を数字で見せるために使う。
 * BASE_HOURS は目安なので 0.5 時間単位に丸める。
 */
export function estimateWeeklyHours(plan: LearningPlan, today: Date): number {
  const iso = toIso(today);
  const currentIdx = currentPhaseIndex(plan, today);
  const mult = EXPERIENCE_MULTIPLIER[plan.intake.experience];

  const remainingHours = plan.phases.reduce((sum, p, i) => {
    if (i < currentIdx) return sum;
    const hours = BASE_HOURS[p.key] * (mult[p.key] ?? 1);
    if (i > currentIdx) return sum + hours;
    // 現在フェーズは未達成のマイルストーン割合ぶんだけ残っているとみなす
    const done = p.milestones.length
      ? p.milestones.reduce((s, m) => s + milestoneProgress(m), 0) / p.milestones.length
      : 0;
    return sum + hours * (1 - done);
  }, 0);

  const weeks = Math.max(1, diffDays(iso, plan.goalDeadline) / 7);
  return Math.max(0.5, Math.round((remainingHours / weeks) * 2) / 2);
}

/** 候補テンプレートからマイルストーンを追加する。 */
export function addMilestoneFromTemplate(
  plan: LearningPlan,
  phaseKey: PhaseKey,
  templateId: string,
  today: Date,
): LearningPlan {
  const tpl = MILESTONE_TEMPLATES.find((t) => t.id === templateId);
  const idx = plan.phases.findIndex((p) => p.key === phaseKey);
  if (!tpl || idx < 0) return plan;
  const phase = plan.phases[idx];
  const target = Math.max(1, Math.round(tpl.defaultTarget * (tpl.unit === '%' ? 1 : targetScale(plan.intake.weeklyHours))));
  const phases = [...plan.phases];
  phases[idx] = { ...phase, milestones: [...phase.milestones, buildMilestone(tpl, target, phase.endDate)] };
  return withUpdated(plan, phases, today);
}

export function removeMilestone(plan: LearningPlan, milestoneId: string, today: Date): LearningPlan {
  const phases = plan.phases.map((p) => ({ ...p, milestones: p.milestones.filter((m) => m.id !== milestoneId) }));
  return withUpdated(plan, phases, today);
}

/** 数値・期限・文言の部分更新。文言を触った場合だけ edited を立てる。 */
export function updateMilestone(
  plan: LearningPlan,
  milestoneId: string,
  patch: Partial<Pick<Milestone, 'action' | 'actionRenyou' | 'criteria' | 'dueDate'>> & { target?: number },
  today: Date,
): LearningPlan {
  const textEdited = patch.action !== undefined || patch.criteria !== undefined;
  const phases = plan.phases.map((p) => ({
    ...p,
    milestones: p.milestones.map((m) => {
      if (m.id !== milestoneId) return m;
      const next: Milestone = { ...m, ...patch, edited: m.edited || textEdited };
      if (textEdited && patch.action !== undefined) next.actionRenyou = null;
      if (patch.target !== undefined && m.metric) {
        next.metric = { ...m.metric, target: Math.max(1, patch.target) };
      }
      return next;
    }),
  }));
  return withUpdated(plan, phases, today);
}

// ============================================================
// 月次更新案の生成
// ============================================================

function phaseRange(p: PlanPhase): string {
  return `${formatJpDate(p.startDate)} 〜 ${formatJpDate(p.endDate)}`;
}

function diff(
  kind: PlanDiff['kind'],
  label: string,
  before: string,
  after: string,
  patch: PlanDiffPatch,
  opts: { phaseKey?: PhaseKey; milestoneId?: string; isDateOnly: boolean },
): PlanDiff {
  return {
    id: newId('diff'),
    kind,
    targetPhaseKey: opts.phaseKey ?? null,
    targetMilestoneId: opts.milestoneId ?? null,
    label,
    before,
    after,
    patch,
    isDateOnly: opts.isDateOnly,
    selected: true,
  };
}

/** 「9月1日 〜 9月28日」 */
function rangeLabel(startIso: string, endIso: string): string {
  return `${formatJpDate(startIso)} 〜 ${formatJpDate(endIso)}`;
}

/**
 * 進捗の実績と受講生のチェックイン回答から更新案を作る。
 * 変更すべき点が1つも無ければ null を返す（無意味な通知を出さない）。
 */
export function proposeRevision(
  plan: LearningPlan,
  signals: ProgressSignals,
  checkin: CheckinAnswers | null,
  today: Date,
): PlanRevision | null {
  const iso = toIso(today);
  const idx = currentPhaseIndex(plan, today);
  const phase = plan.phases[idx];
  if (!phase) return null;

  const diffs: PlanDiff[] = [];
  const reasons: string[] = [];

  // --- 1. 予定に対する実績の遅れ ---
  const phaseDays = Math.max(1, diffDays(phase.startDate, phase.endDate));
  const elapsed = clamp(diffDays(phase.startDate, iso) / phaseDays, 0, 1);
  const done = phase.milestones.length
    ? phase.milestones.reduce((s, m) => s + milestoneProgress(m), 0) / phase.milestones.length
    : elapsed;

  let delayDays = 0;
  if (elapsed > 0.25 && done < elapsed * 0.6) {
    delayDays = clamp(Math.ceil(((elapsed - done) * phaseDays) / 7) * 7, 7, 28);
    reasons.push(`${phase.title}が予定より遅れています`);
  }

  // --- 2. 学習時間の変化 ---
  if (checkin?.hoursChange === 'decreased') {
    delayDays = Math.max(delayDays, Math.ceil((phaseDays * 0.2) / 7) * 7);
    reasons.push('学習時間が減っています');
  }

  if (delayDays > 0) {
    // 現在フェーズは終了日だけ延ばし、以降のフェーズは丸ごと後ろへずらす。
    // 各差分は独立した「適用後の日付」を持つので、全部選んでも二重にずれない。
    diffs.push(
      diff(
        'resize_phase',
        `${phase.title}を${delayDays / 7}週間延ばす`,
        phaseRange(phase),
        rangeLabel(phase.startDate, addDays(phase.endDate, delayDays)),
        { type: 'phase_dates', startDate: phase.startDate, endDate: addDays(phase.endDate, delayDays) },
        { phaseKey: phase.key, isDateOnly: true },
      ),
    );
    plan.phases.slice(idx + 1).forEach((p) => {
      diffs.push(
        diff(
          'shift_phase',
          `${p.title}の開始を${delayDays / 7}週間後ろ倒しする`,
          phaseRange(p),
          rangeLabel(addDays(p.startDate, delayDays), addDays(p.endDate, delayDays)),
          { type: 'phase_dates', startDate: addDays(p.startDate, delayDays), endDate: addDays(p.endDate, delayDays) },
          { phaseKey: p.key, isDateOnly: true },
        ),
      );
    });
  }

  // --- 3. 前倒しできる場合 ---
  if (delayDays === 0 && checkin?.goalResult === 'achieved' && done >= elapsed && idx + 1 < plan.phases.length) {
    const nextPhase = plan.phases[idx + 1];
    diffs.push(
      diff(
        'shift_phase',
        `${nextPhase.title}の開始を1週間前倒しする`,
        phaseRange(nextPhase),
        rangeLabel(addDays(nextPhase.startDate, -7), addDays(nextPhase.endDate, -7)),
        { type: 'phase_dates', startDate: addDays(nextPhase.startDate, -7), endDate: addDays(nextPhase.endDate, -7) },
        { phaseKey: nextPhase.key, isDateOnly: true },
      ),
    );
    reasons.push('予定より順調に進んでいます');
  }

  // --- 4. 目標そのものの変化 ---
  if (checkin?.goalChange === 'later' || checkin?.goalChange === 'earlier') {
    const months = checkin.goalChange === 'later' ? 1 : -1;
    const nextDeadline = addMonths(plan.goalDeadline, months);
    diffs.push(
      diff(
        'shift_goal_deadline',
        `目標期限を1ヶ月${months > 0 ? '後ろ倒し' : '前倒し'}する`,
        formatJpDateFull(plan.goalDeadline),
        formatJpDateFull(nextDeadline),
        { type: 'goal_deadline', goalDeadline: nextDeadline },
        { isDateOnly: true },
      ),
    );
    reasons.push('目標期限の希望が変わっています');
  }

  // --- 5. 負荷が高すぎる場合はマイルストーンを1件落とす ---
  const overloaded =
    checkin != null &&
    checkin.goalResult === 'not_achieved' &&
    (checkin.blockers.includes('time') || checkin.blockers.includes('difficulty'));
  if (overloaded && phase.milestones.length > 1) {
    const drop = [...phase.milestones].sort((a, b) => milestoneProgress(a) - milestoneProgress(b))[0];
    diffs.push(
      diff(
        'drop_milestone',
        `${phase.title}のマイルストーンを1件減らす`,
        formatMilestone(drop),
        '（今回は見送り）',
        { type: 'remove_milestone' },
        { phaseKey: phase.key, milestoneId: drop.id, isDateOnly: false },
      ),
    );
    reasons.push('今月の負荷が高すぎた可能性があります');
  }

  if (diffs.length === 0) return null;

  const dateOnlyCount = diffs.filter((d) => d.isDateOnly).length;
  return {
    id: newId('rev'),
    planId: plan.id,
    userId: plan.userId,
    createdAt: new Date().toISOString(),
    status: 'pending',
    headline: reasons[0] ?? '予定と実績に差があります',
    detail:
      dateOnlyCount === diffs.length
        ? `${diffs[0].label}案を作成しました。`
        : `${diffs[0].label}など、${diffs.length}件の更新候補があります。`,
    signals,
    checkin,
    diffs,
  };
}

// ============================================================
// 差分の適用
// ============================================================

/**
 * 選択された差分だけをプランに適用する。
 * 未選択の差分は無視し、確定済みの内容を勝手に書き換えない。
 *
 * 各差分は patch に「適用後の値」を持っているので、ここでは連動シフトを一切行わない。
 * proposeRevision が既に後続フェーズぶんの差分を個別に作っているため、
 * ここで再度カスケードさせると同じ遅延が二重にかかってしまう。
 * この方式なら、画面でプレビューした before → after がそのまま結果になる。
 */
export function applyDiffs(plan: LearningPlan, diffs: PlanDiff[], today: Date): LearningPlan {
  const selected = diffs.filter((d) => d.selected);

  let goalDeadline = plan.goalDeadline;
  const removedMilestoneIds = new Set<string>();
  const phaseDates = new Map<PhaseKey, { startDate: string; endDate: string }>();
  const phasePriority = new Map<PhaseKey, 1 | 2 | 3>();
  const milestoneDue = new Map<string, string>();

  selected.forEach((d) => {
    switch (d.patch.type) {
      case 'phase_dates':
        if (d.targetPhaseKey) phaseDates.set(d.targetPhaseKey, { startDate: d.patch.startDate, endDate: d.patch.endDate });
        break;
      case 'phase_priority':
        if (d.targetPhaseKey) phasePriority.set(d.targetPhaseKey, d.patch.priority);
        break;
      case 'milestone_due':
        if (d.targetMilestoneId) milestoneDue.set(d.targetMilestoneId, d.patch.dueDate);
        break;
      case 'remove_milestone':
        if (d.targetMilestoneId) removedMilestoneIds.add(d.targetMilestoneId);
        break;
      case 'goal_deadline':
        goalDeadline = d.patch.goalDeadline;
        break;
      default:
        break;
    }
  });

  const phases: PlanPhase[] = plan.phases.map((p) => {
    const dates = phaseDates.get(p.key);
    const shift = dates ? diffDays(p.startDate, dates.startDate) : 0;
    const next: PlanPhase = {
      ...p,
      startDate: dates?.startDate ?? p.startDate,
      endDate: dates?.endDate ?? p.endDate,
      priority: phasePriority.get(p.key) ?? p.priority,
      milestones: p.milestones
        .filter((m) => !removedMilestoneIds.has(m.id))
        .map((m) => ({
          ...m,
          dueDate: milestoneDue.get(m.id) ?? (shift !== 0 ? addDays(m.dueDate, shift) : m.dueDate),
        })),
    };
    // マイルストーン期限がフェーズ末尾を超えないよう丸める
    next.milestones = next.milestones.map((m) => ({ ...m, dueDate: minIso(m.dueDate, next.endDate) }));
    return next;
  });

  const last = phases[phases.length - 1];
  if (last && diffDays(goalDeadline, last.endDate) > 0) goalDeadline = last.endDate;

  const next: LearningPlan = {
    ...plan,
    phases,
    goalDeadline,
    version: plan.version + 1,
    nextReviewDate: nextReviewFrom(toIso(today), goalDeadline),
    updatedAt: new Date().toISOString(),
  };
  next.currentPhaseKey = phases[currentPhaseIndex(next, today)]?.key ?? next.currentPhaseKey;
  return next;
}

/** 「期間だけ変更」用に、日付系の差分だけを選択状態にして返す。 */
export function dateOnlyDiffs(diffs: PlanDiff[]): PlanDiff[] {
  return diffs.map((d) => ({ ...d, selected: d.isDateOnly }));
}
