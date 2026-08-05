/**
 * MSW: 学習アクティビティ（集中ブースのタイマー記録・統計・ストリーク）
 * ============================================================
 * 対応エンドポイント（すべて実BFFには存在しない。バックエンド変更禁止のためモックで提供）
 *   POST   /api/webcoach/study-activities/:userid            記録する（id で冪等）
 *   GET    /api/webcoach/study-activities/:userid            履歴（新しい順・ページング）
 *   GET    /api/webcoach/study-stats/:userid?days=35         今日/今週/今月・ストリーク・日別・教材別
 *   DELETE /api/webcoach/study-activities/:userid/:activityId 1件削除
 *   POST   /api/webcoach/study-activities/:userid/reset       🔴モック確認用（シード再生成）
 *   GET    /api/webcoach/streak/:userid                       ★既存パスの実装差し替え
 *
 * 設計上の判断:
 *   ・🔴 localStorage に永続化する。リロードしても消えないことがこの機能の体験そのもの
 *     （ストリーク・履歴・累計）なので、メモリ保持では検証にならない。
 *     lessonHandlers.ts のノート永続化と同じ readStore/writeStore の作法。
 *   ・🔴 モジュールスコープにストアをキャッシュしない。リクエストごとに読む。
 *     キャッシュすると別タブの記録が見えず、片方の書き込みで消える。
 *   ・🔴 判定ロジックはここに書かない。集計は utils/studyStats.ts の純関数に委ねる。
 *     画面側も同じ関数を使うので「モックと画面でストリークが違う」が起きない。
 *   ・ストリーク（GET /streak）もここから返す。handlers.ts 側の固定モックは削除済み。
 *     ログイン日数ではなく「実際に学習した日数」が単一の正になる。
 * ============================================================
 */
import { http, HttpResponse } from 'msw';
import { format } from 'date-fns';
import {
  StudyActivity,
  StudyActivityInput,
  StudyActivityPage,
} from '../types/studyActivity';
import { StreakInfo } from '../types/mypage';
import {
  clampText,
  periodTotal,
  sortByOccurredDesc,
  summarize,
  toLocalDateKey,
  toStreakInfo,
  weekStartOf,
} from '../utils/studyStats';
import { SEED_ID_PREFIX, buildSeedActivities, describeSeed } from './studyActivitySeed';

const STORE_KEY = 'webcoach-study-activities';

/** localStorage 容量対策。1行 ≒ 600B なので 1000件で ≒600KB */
const MAX_ACTIVITIES = 1000;

const DEFAULT_STATS_DAYS = 35;
const DEFAULT_PAGE_LIMIT = 30;

/** handlers.ts の journey ハンドラが同じ値を返せるようにするための既定ユーザー */
const DEFAULT_USER_ID = 2;

interface ActivityStore {
  version: 1;
  /** シードを生成した日（YYYY-MM-DD）。日が変わったらシードだけ作り直す */
  seededOn: string;
  activities: StudyActivity[];
}

function todayKey(): string {
  return toLocalDateKey(new Date());
}

function emptyStore(): ActivityStore {
  return { version: 1, seededOn: '', activities: [] };
}

/** シード行を捨てて今日起点で作り直す。自分で記録した行は必ず残す */
function reseed(store: ActivityStore, userId: number): ActivityStore {
  const mine = store.activities.filter((a) => !a.id.startsWith(SEED_ID_PREFIX));
  const next: ActivityStore = {
    version: 1,
    seededOn: todayKey(),
    activities: [...buildSeedActivities(userId, new Date()), ...mine],
  };
  writeStore(next);
  return next;
}

function readStore(userId: number = DEFAULT_USER_ID): ActivityStore {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return reseed(emptyStore(), userId);
    const parsed = JSON.parse(raw) as Partial<ActivityStore>;
    const store: ActivityStore = {
      version: 1,
      seededOn: parsed.seededOn ?? '',
      activities: Array.isArray(parsed.activities) ? parsed.activities : [],
    };
    // ストリーク・カレンダーは「今日起点」で見えないと機能の確認にならない。
    // 日が変わったらシード行だけ作り直す。
    if (store.seededOn !== todayKey()) return reseed(store, userId);
    return store;
  } catch {
    return reseed(emptyStore(), userId);
  }
}

function writeStore(store: ActivityStore): void {
  const trimmed: ActivityStore = {
    ...store,
    activities: store.activities.slice(-MAX_ACTIVITIES),
  };
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(trimmed));
  } catch {
    // 容量超過。古い2割を捨てて1度だけ再試行する（モックなので失敗しても黙って諦める）
    try {
      const dropCount = Math.floor(trimmed.activities.length * 0.2);
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ ...trimmed, activities: trimmed.activities.slice(dropCount) })
      );
    } catch {
      /* 諦める */
    }
  }
}

function userIdOf(params: Record<string, unknown>): number {
  const raw = params.userid;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_USER_ID;
}

function activitiesOf(userId: number): StudyActivity[] {
  // シードは DEFAULT_USER_ID で作られるので、モックでは userId 一致を厳密には見ない。
  // 実BFF移行時はサーバ側で認証ユーザーに絞られる。
  return readStore(userId).activities;
}

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * handlers.ts の journey ハンドラ用。ストリークを2箇所で別々に計算しないための入口。
 * （旧 streakMock を単一の正にしていた意図を、学習アクティビティに移したもの）
 */
export function currentStreakInfo(userId: number = DEFAULT_USER_ID): StreakInfo {
  return toStreakInfo(activitiesOf(userId), new Date());
}

export const studyActivityHandlers = [
  // 注意: リテラルの 'reset' を ':activityId' より先に登録する。
  //       後にすると 'reset' が activityId として食われる。
  http.post('*/api/webcoach/study-activities/:userid/reset', async ({ params, request }) => {
    await delay(200);
    const userId = userIdOf(params);
    const seed = new URL(request.url).searchParams.get('seed') !== 'false';
    const store: ActivityStore = seed
      ? { version: 1, seededOn: todayKey(), activities: buildSeedActivities(userId, new Date()) }
      : { version: 1, seededOn: todayKey(), activities: [] };
    writeStore(store);
    // eslint-disable-next-line no-console
    console.info(`[MSW] 学習アクティビティを再生成: ${describeSeed(store.activities)}`);
    return HttpResponse.json({ ok: true, count: store.activities.length });
  }),

  // 今日/今週/今月・ストリーク・日別・教材別・最近の履歴をまとめて返す。
  // 画面はこれ1本で描けるようにしてある（リクエストを増やさない）。
  http.get('*/api/webcoach/study-stats/:userid', async ({ params, request }) => {
    await delay();
    const userId = userIdOf(params);
    const daysParam = Number(new URL(request.url).searchParams.get('days'));
    const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 400) : DEFAULT_STATS_DAYS;
    return HttpResponse.json(summarize(activitiesOf(userId), new Date(), days));
  }),

  http.post('*/api/webcoach/study-activities/:userid', async ({ request, params }) => {
    await delay();
    const userId = userIdOf(params);

    let input: StudyActivityInput;
    try {
      input = (await request.json()) as StudyActivityInput;
    } catch {
      return HttpResponse.json({ error: 'invalid body' }, { status: 400 });
    }
    if (!input?.id || !input.session) {
      return HttpResponse.json({ error: 'id と session は必須です' }, { status: 400 });
    }

    const store = readStore(userId);

    // 冪等: 同じ id が再送されたら既存を返す。
    // 二重タブ・ダブルクリック・リトライで重複記録が生まれない。
    const existing = store.activities.find((a) => a.id === input.id);
    if (existing) return HttpResponse.json(existing);

    const now = new Date();
    const nowIso = now.toISOString();
    // 「今週の累計学習時間」は記録時点のスナップショット（要件の自動記録項目）。
    // 集計には使わない — 集計は常に配列から導出する。
    const weekBefore = periodTotal(
      store.activities,
      format(weekStartOf(now), 'yyyy-MM-dd'),
      toLocalDateKey(now)
    ).minutes;

    const activity: StudyActivity = {
      ...input,
      userId,
      session: {
        ...input.session,
        goalText: clampText(input.session.goalText),
        contentNote: clampText(input.session.contentNote),
        memo: clampText(input.session.memo),
        weeklyTotalMinutesAtEnd: weekBefore + input.session.durationMinutes,
      },
      social: {
        visibility: input.visibility ?? 'private',
        reactionCounts: {},
        myReactions: [],
        commentCount: 0,
      },
      createdAt: nowIso,
      updatedAt: nowIso,
      schemaVersion: 1,
    };

    store.activities.push(activity);
    writeStore(store);
    return HttpResponse.json(activity);
  }),

  http.get('*/api/webcoach/study-activities/:userid', async ({ params, request }) => {
    await delay();
    const userId = userIdOf(params);
    const q = new URL(request.url).searchParams;
    const from = q.get('from');
    const to = q.get('to');
    const courseIdRaw = q.get('courseId');
    const courseId = courseIdRaw ? Number(courseIdRaw) : undefined;
    const limit = Number(q.get('limit')) || DEFAULT_PAGE_LIMIT;
    const offset = Number(q.get('offset')) || 0;

    const filtered = activitiesOf(userId).filter((a) => {
      if (from && a.localDate < from) return false;
      if (to && a.localDate > to) return false;
      if (courseId !== undefined && (a.course?.courseId ?? null) !== courseId) return false;
      return true;
    });

    const sorted = sortByOccurredDesc(filtered);
    const page: StudyActivityPage = {
      items: sorted.slice(offset, offset + limit),
      total: sorted.length,
      hasMore: offset + limit < sorted.length,
    };
    return HttpResponse.json(page);
  }),

  http.delete('*/api/webcoach/study-activities/:userid/:activityId', async ({ params }) => {
    await delay(200);
    const userId = userIdOf(params);
    const store = readStore(userId);
    const before = store.activities.length;
    store.activities = store.activities.filter((a) => a.id !== params.activityId);
    if (store.activities.length === before) {
      return HttpResponse.json({ error: 'not found' }, { status: 404 });
    }
    writeStore(store);
    return HttpResponse.json({ ok: true });
  }),

  // ★既存パスの実装差し替え。handlers.ts 側の固定モック（12日）は削除済み。
  //   ログイン日数ではなく「1日10分以上学習した日」の連続をストリークとして返す。
  http.get('*/api/webcoach/streak/:userid', async ({ params }) => {
    await delay(150);
    return HttpResponse.json(currentStreakInfo(userIdOf(params)));
  }),
];

export default studyActivityHandlers;
