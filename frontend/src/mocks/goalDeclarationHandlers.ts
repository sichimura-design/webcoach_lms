/**
 * MSW: 目標宣言（受講生が自分の言葉で書く、期間つきの意思表明と振り返り）
 * ============================================================
 * 対応エンドポイント（すべて実BFFには存在しない。バックエンド変更禁止のためモックで提供）
 *   GET    /api/webcoach/goal-declarations/:userid            一覧（新しい順）
 *   POST   /api/webcoach/goal-declarations/:userid            作成（id で冪等）
 *   PATCH  /api/webcoach/goal-declarations/:userid/:id        編集・振り返りの保存
 *   DELETE /api/webcoach/goal-declarations/:userid/:id        削除
 *   POST   /api/webcoach/goal-declarations/:userid/reset      🔴モック確認用
 *
 * 設計上の判断:
 *   ・ストアをこのファイルに内包する。coachingGoalsStore.ts が独立モジュールなのは
 *     「handlers.ts と coachingHandlers.ts の“両方が”読み書きするから（循環import回避）」で、
 *     目標宣言は自分のハンドラしか触らないのでその条件に当てはまらない。
 *     studyActivityHandlers.ts と同じ形にしておく。
 *     将来コーチングノートから宣言を作る導線が付いたら、そのとき切り出すこと。
 *   ・🔴 モジュールスコープにキャッシュしない。リクエストごとに read する
 *     （キャッシュすると別タブの編集が見えず、片方の書き込みで消える）。
 *   ・🔴 判定ロジックはここに書かない。検証は utils/goalDeclaration.ts の純関数に委ねる。
 *     画面も送信前に同じ関数を呼ぶので、400 の文言が2種類にならない。
 *   ・🔴 シードは一度だけ。日が変わっても作り直さない。
 *     学習アクティビティが毎日 reseed するのは「ストリークとカレンダーが今日起点で
 *     見えないと機能の確認にならない」からで、宣言は履歴が残ること自体が仕様。
 *     日次で作り直すと、消した宣言が翌日復活し、書いた振り返りも消える。
 *     seeded フラグが「自分で全部消した0件」と「まだ置かれていない0件」を区別する。
 * ============================================================
 */
import { http, HttpResponse } from 'msw';
import {
  GoalDeclaration,
  GoalDeclarationInput,
  GoalDeclarationPatch,
  GoalDeclarationStatus,
} from '../types/goalDeclaration';
import {
  clampDeclarationText,
  clampReflection,
  sortDeclarations,
  validateDeclarationInput,
  validateDeclarationPatch,
} from '../utils/goalDeclaration';

const STORE_KEY = 'webcoach-goal-declarations';

/** localStorage 容量対策。宣言は月に1〜数件なので、これでも数年ぶん入る */
const MAX_DECLARATIONS = 200;

interface DeclarationStore {
  version: 1;
  /** 「自分で全部消した0件」と「まだシードしていない0件」を区別する */
  seeded: boolean;
  items: GoalDeclaration[];
}

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

function userIdOf(params: Record<string, unknown>): number {
  return Number(params.userid) || 0;
}

/** 今日から n 日ずらしたローカル日キー。🔴 toISOString().slice(0,10) を使わない（UTCで1日ずれる） */
function dayKey(offsetDays: number, from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 月初・月末（offsetMonths = 0 で今月）。過去の宣言を「先月ぶん」として置くのに使う */
function monthRange(offsetMonths: number, from: Date = new Date()): { start: string; end: string } {
  const first = new Date(from.getFullYear(), from.getMonth() + offsetMonths, 1);
  const last = new Date(from.getFullYear(), from.getMonth() + offsetMonths + 1, 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: fmt(first), end: fmt(last) };
}

/**
 * 初期の宣言3件。
 * 🔴 Math.random() を使わない。リロードのたびに文面が変わると
 *    「表示がおかしいのは仕様かバグか」を判別できなくなる（studyActivitySeed.ts と同じ方針）。
 * 🔴 日付は今日起点の相対。固定文字列にすると、時間が経つほど
 *    「進行中の宣言が無い画面」しか見られなくなる。
 *
 * 仕込んである条件:
 *   1件目 … 進行中（トップページの目標宣言カードに出る）
 *   2件目 … 先月ぶん・達成した＋振り返りあり
 *   3件目 … 先々月ぶん・届かなかった＋振り返りあり（達成だけが並ばないように）
 */
function buildSeed(userId: number): GoalDeclaration[] {
  const now = new Date();
  const iso = (offsetDays: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays, 21, 0, 0).toISOString();
  const lastMonth = monthRange(-1, now);
  const twoMonthsAgo = monthRange(-2, now);

  return [
    {
      id: 'gd-seed-1',
      userId,
      text: '今月中にLPを1本、自分の手で完成させる',
      periodFrom: dayKey(-2, now),
      periodTo: dayKey(4, now),
      status: 'active',
      reflection: null,
      reflectionAchievement: null,
      reflectedAt: null,
      createdAt: iso(-2),
      updatedAt: iso(-2),
      schemaVersion: 1,
    },
    {
      id: 'gd-seed-2',
      userId,
      text: 'バナーを10本つくって、当たり外れの傾向をつかむ',
      periodFrom: lastMonth.start,
      periodTo: lastMonth.end,
      status: 'achieved',
      reflection:
        '10本やってみて、余白を広く取ったほうが情報が少なくても成立すると分かった。逆に文字を詰めた案は自分でも読み返す気にならなかった。',
      reflectionAchievement: 'high',
      reflectedAt: `${lastMonth.end}T21:00:00+09:00`,
      createdAt: `${lastMonth.start}T09:00:00+09:00`,
      updatedAt: `${lastMonth.end}T21:00:00+09:00`,
      schemaVersion: 1,
    },
    {
      id: 'gd-seed-3',
      userId,
      text: 'HTML/CSSの基礎を一周する',
      periodFrom: twoMonthsAgo.start,
      periodTo: twoMonthsAgo.end,
      status: 'missed',
      reflection:
        'flexbox の途中で止まってしまった。平日に30分ずつのつもりが、週末にまとめてやろうとして結局できなかった。次は平日に寄せる。',
      reflectionAchievement: 'low',
      reflectedAt: `${twoMonthsAgo.end}T21:00:00+09:00`,
      createdAt: `${twoMonthsAgo.start}T09:00:00+09:00`,
      updatedAt: `${twoMonthsAgo.end}T21:00:00+09:00`,
      schemaVersion: 1,
    },
  ];
}

function normalize(raw: unknown, userId: number): DeclarationStore {
  const parsed = (raw ?? {}) as Partial<DeclarationStore>;
  if (parsed.seeded && Array.isArray(parsed.items)) {
    return { version: 1, seeded: true, items: parsed.items };
  }
  // 未シードのときだけ置く。seeded が立っていれば 0 件でもそのまま尊重する
  return { version: 1, seeded: true, items: buildSeed(userId) };
}

function read(userId: number): DeclarationStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const store = normalize(raw ? JSON.parse(raw) : null, userId);
    if (!raw) write(store);
    return store;
  } catch {
    return { version: 1, seeded: true, items: buildSeed(userId) };
  }
}

function write(store: DeclarationStore): void {
  try {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ ...store, items: store.items.slice(-MAX_DECLARATIONS) })
    );
  } catch {
    /* 容量超過などは黙って諦める（モックのため） */
  }
}

export const goalDeclarationHandlers = [
  // 🔴 リテラルの 'reset' を ':declarationId' より先に登録する。
  //    後にすると 'reset' が declarationId として食われる。
  http.post('*/api/webcoach/goal-declarations/:userid/reset', async ({ params }) => {
    await delay();
    const userId = userIdOf(params);
    const store: DeclarationStore = { version: 1, seeded: true, items: buildSeed(userId) };
    write(store);
    // eslint-disable-next-line no-console
    console.info(`[MSW] 目標宣言を再生成: ${store.items.length}件`);
    return HttpResponse.json({ ok: true, count: store.items.length });
  }),

  http.get('*/api/webcoach/goal-declarations/:userid', async ({ params, request }) => {
    await delay(150);
    const userId = userIdOf(params);
    const q = new URL(request.url).searchParams;
    const status = q.get('status') as GoalDeclarationStatus | null;
    const limit = Number(q.get('limit')) || 0;

    let items = sortDeclarations(read(userId).items);
    if (status) items = items.filter((d) => d.status === status);
    if (limit > 0) items = items.slice(0, limit);
    return HttpResponse.json(items);
  }),

  http.post('*/api/webcoach/goal-declarations/:userid', async ({ params, request }) => {
    await delay();
    const userId = userIdOf(params);

    let input: GoalDeclarationInput;
    try {
      input = (await request.json()) as GoalDeclarationInput;
    } catch {
      return HttpResponse.json({ error: 'invalid body' }, { status: 400 });
    }

    const invalid = validateDeclarationInput(input);
    if (invalid) return HttpResponse.json({ error: invalid }, { status: 400 });

    const store = read(userId);

    // 冪等: 同じ id が再送されたら既存を返す（二重タブ・ダブルクリック・リトライ対策）
    const existing = store.items.find((d) => d.id === input.id);
    if (existing) return HttpResponse.json(existing);

    const nowIso = new Date().toISOString();
    const created: GoalDeclaration = {
      id: input.id,
      userId,
      text: clampDeclarationText(input.text),
      periodFrom: input.periodFrom,
      periodTo: input.periodTo,
      status: 'active',
      reflection: null,
      reflectionAchievement: null,
      reflectedAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      schemaVersion: 1,
    };
    store.items.push(created);
    write(store);
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch('*/api/webcoach/goal-declarations/:userid/:declarationId', async ({ params, request }) => {
    await delay();
    const userId = userIdOf(params);

    let patch: GoalDeclarationPatch;
    try {
      patch = (await request.json()) as GoalDeclarationPatch;
    } catch {
      return HttpResponse.json({ error: 'invalid body' }, { status: 400 });
    }

    const store = read(userId);
    const index = store.items.findIndex((d) => d.id === params.declarationId);
    if (index < 0) return HttpResponse.json({ error: 'not found' }, { status: 404 });

    const cur = store.items[index];
    const invalid = validateDeclarationPatch(cur, patch);
    if (invalid) return HttpResponse.json({ error: invalid }, { status: 400 });

    const reflection = patch.reflection !== undefined ? clampReflection(patch.reflection) : cur.reflection;
    const next: GoalDeclaration = {
      ...cur,
      text: patch.text !== undefined ? clampDeclarationText(patch.text) : cur.text,
      periodFrom: patch.periodFrom ?? cur.periodFrom,
      periodTo: patch.periodTo ?? cur.periodTo,
      status: patch.status ?? cur.status,
      reflection,
      reflectionAchievement:
        patch.reflectionAchievement !== undefined
          ? patch.reflectionAchievement
          : cur.reflectionAchievement,
      // 振り返りを最初に書いた時刻を残す。書き直しても最初の打刻は動かさない
      reflectedAt: reflection ? (cur.reflectedAt ?? new Date().toISOString()) : null,
      updatedAt: new Date().toISOString(),
    };

    store.items[index] = next;
    write(store);
    return HttpResponse.json(next);
  }),

  http.delete('*/api/webcoach/goal-declarations/:userid/:declarationId', async ({ params }) => {
    await delay(200);
    const userId = userIdOf(params);
    const store = read(userId);
    const before = store.items.length;
    store.items = store.items.filter((d) => d.id !== params.declarationId);
    if (store.items.length === before) {
      return HttpResponse.json({ error: 'not found' }, { status: 404 });
    }
    write(store);
    return new HttpResponse(null, { status: 204 });
  }),
];

export default goalDeclarationHandlers;
