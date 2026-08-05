/**
 * frontend/src/mocks/learningPlanHandlers.ts
 * 学習ロードマップ（LearningPlan）のMSWモック。
 * ============================================================
 * 実BFFに該当エンドポイントは無いため、フロント側で完結させる。
 * 生成・差分・適用のロジックは utils/learningPlanTemplate.ts の純関数をそのまま呼ぶ
 * （UIとサーバーで挙動がずれないようにするため、ここには判断ロジックを書かない）。
 *
 * 状態は既存モックと同じくモジュールスコープのメモリ上に持つ。リロードで初期化される。
 * ============================================================
 */
import { http, HttpResponse } from 'msw';
import {
  CheckinAnswers,
  CheckinPrompt,
  IntakeAnswers,
  LearningPlan,
  LearningPlanPatch,
  PlanRevision,
  ProgressSignals,
  RevisionAction,
} from '../types/learningPlan';
import {
  CHECKIN_QUESTIONS,
  INTAKE_QUESTIONS,
  MILESTONE_TEMPLATES,
  addDays,
  applyDiffs,
  currentPhaseIndex,
  dateOnlyDiffs,
  diffDays,
  generateLearningPlan,
  proposeRevision,
  toIso,
} from '../utils/learningPlanTemplate';

const MOCK_USER_ID = 2;

// ---- ストア（メモリ上。リロードで消える） ----------------------------------
const plansStore: Record<number, LearningPlan> = {};
const revisionsStore: Record<number, PlanRevision[]> = {};
const checkinAnsweredStore: Record<number, boolean> = {};
const signalsStore: Record<number, ProgressSignals> = {};

// ---- シード -----------------------------------------------------------------

/** 6ヶ月プランの2ヶ月目・制作練習が予定より遅れている状態を、実行時の今日を基準に組み立てる。 */
function seed(): void {
  const today = new Date();
  // 2ヶ月前に開始したことにする
  const started = new Date(today);
  started.setMonth(started.getMonth() - 2);

  const intake: IntakeAnswers = {
    workStyle: 'side_job',
    skills: ['design_basics', 'banner', 'lp'],
    deadlineMonths: 6,
    weeklyHours: 8,
    experience: 'none',
    wantsClientWork: true,
    focus: 'banner',
    busyMonths: [],
  };

  const plan = generateLearningPlan(MOCK_USER_ID, intake, started);
  // 既存の journey モックのゴール文言と揃えておく（マイページ内で表現がぶれないように）
  plan.goal = 'Webデザイナーとして初案件を獲得する';
  plan.status = 'confirmed_with_coach';
  plan.confirmedAt = new Date(started).toISOString();
  plan.confirmedCoachName = '田中コーチ';
  // 見直し日は3日後 → 起動直後から月次チェックインの導線が出る
  plan.nextReviewDate = addDays(toIso(today), 3);

  // 実績を入れる: 序盤のフェーズは完了、現在フェーズは明確に遅れている状態にする。
  // 「1件目に少し着手・2件目は未着手」だと期待進捗の6割を下回り、proposeRevision が
  // 遅れとして検知する（＝起動直後から更新候補カードが見える）。
  const currentIdx = currentPhaseIndex(plan, today);
  plan.phases.forEach((phase, i) => {
    phase.milestones.forEach((m, mi) => {
      if (i < currentIdx) {
        m.status = 'done';
        if (m.metric) m.metric.current = m.metric.target;
      } else if (i === currentIdx && mi === 0) {
        m.status = 'in_progress';
        if (m.metric) m.metric.current = Math.min(m.metric.target, Math.max(1, Math.round(m.metric.target * 0.35)));
      }
    });
  });
  plan.currentPhaseKey = plan.phases[currentIdx]?.key ?? plan.currentPhaseKey;

  plansStore[MOCK_USER_ID] = plan;
  signalsStore[MOCK_USER_ID] = {
    courseProgressPercent: 62,
    submissions: 3,
    artifacts: 4,
    taskCompletionRate: 58,
    applications: 0,
    weeklyStudyMinutes: 260,
    plannedWeeklyMinutes: 480,
  };
  checkinAnsweredStore[MOCK_USER_ID] = false;

  // 未操作でも溜まっていく更新案を1件シードしておく（チェックイン未回答＝実績だけで生成した案）
  const seeded = proposeRevision(plan, signalsStore[MOCK_USER_ID], null, today);
  revisionsStore[MOCK_USER_ID] = seeded ? [seeded] : [];
}

seed();

// ---- ヘルパー ---------------------------------------------------------------

function userIdOf(params: Record<string, unknown>): number {
  return Number(params.userid) || MOCK_USER_ID;
}

function signalsFor(userId: number): ProgressSignals {
  return (
    signalsStore[userId] ?? {
      courseProgressPercent: 0, submissions: 0, artifacts: 0, taskCompletionRate: 0,
      applications: 0, weeklyStudyMinutes: 0, plannedWeeklyMinutes: 480,
    }
  );
}

function pendingOf(userId: number): PlanRevision[] {
  return (revisionsStore[userId] ?? []).filter((r) => r.status === 'pending');
}

function buildCheckinPrompt(plan: LearningPlan | undefined, userId: number): CheckinPrompt {
  const dueDate = plan?.nextReviewDate ?? toIso(new Date());
  const answered = checkinAnsweredStore[userId] === true;
  return {
    dueDate,
    answered,
    // 見直し日の3日前から出す（「次回コーチングの数日前に表示する」要件）
    due: !answered && diffDays(toIso(new Date()), dueDate) <= 3,
    questions: CHECKIN_QUESTIONS,
  };
}

// ---- ハンドラ ---------------------------------------------------------------
// 注意: ':userid' より先にリテラルのパス（intake-questions / milestone-templates）を
//       登録しないと、リテラル部分が userid として食われてしまう。

export const learningPlanHandlers = [
  // 初回質問の定義
  http.get('*/api/webcoach/learning-plan/intake-questions', () => HttpResponse.json(INTAKE_QUESTIONS)),

  // マイルストーン候補テンプレート
  http.get('*/api/webcoach/learning-plan/milestone-templates', ({ request }) => {
    const phase = new URL(request.url).searchParams.get('phaseKey');
    return HttpResponse.json(phase ? MILESTONE_TEMPLATES.filter((t) => t.phaseKey === phase) : MILESTONE_TEMPLATES);
  }),

  // 月次チェックインの質問＋回答状況
  http.get('*/api/webcoach/learning-plan/:userid/checkin', ({ params }) => {
    const userId = userIdOf(params);
    return HttpResponse.json(buildCheckinPrompt(plansStore[userId], userId));
  }),

  // 月次チェックインの回答 → 更新案を生成して返す
  http.post('*/api/webcoach/learning-plan/:userid/checkin', async ({ request, params }) => {
    const userId = userIdOf(params);
    const plan = plansStore[userId];
    if (!plan) return HttpResponse.json(null, { status: 404 });

    const answers = (await request.json()) as CheckinAnswers;
    checkinAnsweredStore[userId] = true;

    const revision = proposeRevision(plan, signalsFor(userId), answers, new Date());
    if (!revision) return HttpResponse.json(null);

    // 古い未確認の案は新しい案に置き換える（同じ内容が二重に溜まらないように）
    const list = revisionsStore[userId] ?? [];
    list.forEach((r) => {
      if (r.status === 'pending') r.status = 'superseded';
    });
    revisionsStore[userId] = [revision, ...list];
    return HttpResponse.json(revision);
  }),

  // 更新案の一覧（未操作で溜まった分もそのまま返す）
  http.get('*/api/webcoach/learning-plan/:userid/revisions', ({ params }) =>
    HttpResponse.json(revisionsStore[userIdOf(params)] ?? []),
  ),

  // 更新案への回答（提案どおり / 期間だけ / 現状維持 / 選んだ項目だけ）
  http.post('*/api/webcoach/learning-plan/:userid/revisions/:revisionId/resolve', async ({ request, params }) => {
    const userId = userIdOf(params);
    const plan = plansStore[userId];
    const list = revisionsStore[userId] ?? [];
    const revision = list.find((r) => r.id === params.revisionId);
    if (!plan || !revision) return HttpResponse.json(null, { status: 404 });

    const body = (await request.json()) as { action: RevisionAction; selectedDiffIds?: string[] };
    const today = new Date();

    if (body.action === 'keep_current') {
      revision.status = 'dismissed';
      // 現状維持でも見直し日だけは先に進める（同じ案が翌日また出るのを防ぐ）
      plan.nextReviewDate = addDays(toIso(today), 30);
      checkinAnsweredStore[userId] = false;
      return HttpResponse.json({ plan, revision });
    }

    let diffs = revision.diffs;
    if (body.action === 'apply_dates_only') diffs = dateOnlyDiffs(diffs);
    if (body.action === 'apply_selected') {
      const ids = new Set(body.selectedDiffIds ?? []);
      diffs = diffs.map((d) => ({ ...d, selected: ids.has(d.id) }));
    }

    plansStore[userId] = applyDiffs(plan, diffs, today);
    revision.status = 'applied';
    checkinAnsweredStore[userId] = false;
    return HttpResponse.json({ plan: plansStore[userId], revision });
  }),

  // 初回質問の回答 → ロードマップを自動生成
  http.post('*/api/webcoach/learning-plan/:userid/intake', async ({ request, params }) => {
    const userId = userIdOf(params);
    const answers = (await request.json()) as IntakeAnswers;
    const plan = generateLearningPlan(userId, answers, new Date());
    plansStore[userId] = plan;
    revisionsStore[userId] = [];
    checkinAnsweredStore[userId] = false;
    signalsStore[userId] = {
      courseProgressPercent: 0, submissions: 0, artifacts: 0, taskCompletionRate: 0,
      applications: 0, weeklyStudyMinutes: 0, plannedWeeklyMinutes: answers.weeklyHours * 60,
    };
    return HttpResponse.json(plan);
  }),

  // 「コーチと確認しました」を記録する（コーチはLMSを操作しないため、押すのは受講生本人）
  http.post('*/api/webcoach/learning-plan/:userid/confirm', async ({ request, params }) => {
    const userId = userIdOf(params);
    const plan = plansStore[userId];
    if (!plan) return HttpResponse.json(null, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as { coachName?: string };
    plan.status = 'confirmed_with_coach';
    plan.confirmedAt = new Date().toISOString();
    plan.confirmedCoachName = body.coachName ?? null;
    plan.updatedAt = plan.confirmedAt;
    return HttpResponse.json(plan);
  }),

  // モック確認用: プランを消して初回設定からやり直せるようにする
  http.post('*/api/webcoach/learning-plan/:userid/reset', ({ params }) => {
    const userId = userIdOf(params);
    delete plansStore[userId];
    delete revisionsStore[userId];
    delete checkinAnsweredStore[userId];
    return HttpResponse.json({ ok: true });
  }),

  // プラン取得（未作成なら null）
  http.get('*/api/webcoach/learning-plan/:userid', ({ params }) =>
    HttpResponse.json(plansStore[userIdOf(params)] ?? null),
  ),

  // 期間・マイルストーンの調整を保存する
  http.patch('*/api/webcoach/learning-plan/:userid', async ({ request, params }) => {
    const userId = userIdOf(params);
    const plan = plansStore[userId];
    if (!plan) return HttpResponse.json(null, { status: 404 });

    const patch = (await request.json()) as LearningPlanPatch;
    const next: LearningPlan = { ...plan, ...patch, updatedAt: new Date().toISOString() };
    // 受講生が自分で調整した時点でLMSの生成物そのものではなくなる。
    // ただしコーチと確認済みのプランは、その事実まで巻き戻さない。
    if (next.status === 'lms_generated') next.status = 'student_reviewed';
    next.currentPhaseKey = next.phases[currentPhaseIndex(next, new Date())]?.key ?? next.currentPhaseKey;
    plansStore[userId] = next;
    return HttpResponse.json(next);
  }),
];

/** モック確認用に、未回答の更新候補が何件溜まっているかを見たいとき用（デバッグ補助）。 */
export function __pendingRevisionCount(userId = MOCK_USER_ID): number {
  return pendingOf(userId).length;
}
