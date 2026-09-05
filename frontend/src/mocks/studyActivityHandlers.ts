/**
 * MSW: 学習アクティビティ（集中ブースのタイマー記録・統計・ストリーク）
 * ============================================================
 * 対応エンドポイント（すべて実BFFには存在しない。バックエンド変更禁止のためモックで提供）
 *   POST   /api/webcoach/study-activities/:userid            記録する（id で冪等・手動追加も同じ口）
 *   GET    /api/webcoach/study-activities/:userid            履歴（新しい順・ページング）
 *   GET    /api/webcoach/study-stats/:userid?days=35|all     今日/今週/今月・ストリーク・日別・月別・教材別
 *   PATCH  /api/webcoach/study-activities/:userid/:activityId 1件編集（時間・教材・メモ・日付）
 *   DELETE /api/webcoach/study-activities/:userid/:activityId 1件削除
 *   POST   /api/webcoach/study-activities/:userid/reset       🔴モック確認用（シード再生成）
 *   GET    /api/webcoach/study-ranking/:userid?period=week|month    学習時間ランキング
 *   GET    /api/webcoach/study-ranking-streak/:userid?period=month|total ストリークランキング
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
  StudyActivityPatch,
} from '../types/studyActivity';
import { StreakInfo } from '../types/mypage';
import {
  StreakRanking,
  StreakRankingEntry,
  StreakRankingPeriod,
  StudyRanking,
  StudyRankingEntry,
  StudyRankingPeriod,
} from '../types/focusBooth';
import {
  applyActivityPatch,
  clampText,
  computeStreak,
  monthStartOf,
  periodTotal,
  sortByOccurredDesc,
  studyDayKeys,
  summarize,
  toLocalDateKey,
  toStreakInfo,
  validateActivityPatch,
  weekStartOf,
} from '../utils/studyStats';
import { SEED_ID_PREFIX, buildSeedActivities, describeSeed } from './studyActivitySeed';
import { MY_RANKING_EMOJI, STUDY_PEERS } from './studyPeers';

const STORE_KEY = 'webcoach-study-activities';

/** localStorage 容量対策。1行 ≒ 600B なので 1000件で ≒600KB */
const MAX_ACTIVITIES = 1000;

const DEFAULT_STATS_DAYS = 35;

/** days に数値で上限を超える値が来たときの天井（≒3年）。days=all はこの制限を受けない */
const MAX_STATS_DAYS = 1200;
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

// ---- 学習時間ランキング ----------------------------------------------------
// 実BFFには存在しない（他ユーザー横断の集計はサーバの仕事）。
// モックでは「自分の値だけ実データ、他の人は studyPeers.ts の固定名簿」で作る。
//
// 🔴 自分の分は必ず periodTotal で実データから出す。
//    固定値にすると、集中ブースでタイマーを回しても自分の行だけ動かず、
//    「記録が反映されている」という体験そのものが確認できなくなる。
// 🔴 順位はここ（＝サーバ役）で確定させ、画面側では並べ替えない。
//    2箇所で並べ替えると、同着のときに表示がぶれる。

const MONTH_FACTOR = 4.3;

function periodRangeOf(period: StudyRankingPeriod, now: Date) {
  const start = period === 'week' ? weekStartOf(now) : monthStartOf(now);
  return { fromKey: toLocalDateKey(start), toKey: toLocalDateKey(now), start };
}

function peerMinutes(weeklyMinutes: number, period: StudyRankingPeriod, seed: string): number {
  if (period === 'week') return weeklyMinutes;
  // 月次は週の約4.3倍。全員が同じ倍率だと順位が週とまったく同じになるので、
  // id の文字コードで ±12% の範囲だけ散らして「月で見ると順位が違う」を作る。
  const jitter = ((seed.charCodeAt(seed.length - 1) % 25) - 12) / 100;
  return Math.round(weeklyMinutes * MONTH_FACTOR * (1 + jitter));
}

function buildRanking(userId: number, period: StudyRankingPeriod): StudyRanking {
  const now = new Date();
  const { fromKey, toKey, start } = periodRangeOf(period, now);
  const myMinutes = periodTotal(activitiesOf(userId), fromKey, toKey).minutes;

  const rows = [
    ...STUDY_PEERS.map((p) => ({
      nickname: p.nickname,
      avatarEmoji: p.avatarEmoji,
      minutes: peerMinutes(p.weeklyMinutes, period, p.id),
      isMe: false,
    })),
    { nickname: 'あなた', avatarEmoji: MY_RANKING_EMOJI, minutes: myMinutes, isMe: true },
  ];

  // 同着は自分を上に置く。自分の行が下に沈んで見つけにくいのを避ける。
  rows.sort((a, b) => b.minutes - a.minutes || (a.isMe ? -1 : b.isMe ? 1 : 0));

  const entries: StudyRankingEntry[] = rows.map((r, i) => ({ ...r, rank: i + 1 }));
  const me = entries.find((e) => e.isMe)!;

  const label =
    period === 'week'
      ? `今週（${start.getMonth() + 1}/${start.getDate()}〜）`
      : `${start.getMonth() + 1}月`;

  return { period, periodLabel: label, entries, me, participantCount: entries.length };
}

// ---- ストリークランキング ---------------------------------------------------
// 学習時間ランキングと同じ作法（自分は実データ・他人は固定名簿・順位はここで確定）。
//
// 🔴 並べるのは「連続日数」ではなく「学習した日数」。
//    連続日数は1日空くと 0 に戻るので、ランキングにすると順位が乱高下して意味が読めない。
//    ・month … 今月の学習日数（computeStreak の monthStudyDays と同じ定義）
//    ・total … 累計の学習日数（studyDayKeys の件数）

function buildStreakRanking(userId: number, period: StreakRankingPeriod): StreakRanking {
  const mine = activitiesOf(userId);
  const myDays =
    period === 'month' ? computeStreak(mine, new Date()).monthStudyDays : studyDayKeys(mine).length;

  const rows = [
    ...STUDY_PEERS.map((p) => ({
      nickname: p.nickname,
      avatarEmoji: p.avatarEmoji,
      days: period === 'month' ? p.monthStudyDays : p.totalStudyDays,
      isMe: false,
    })),
    { nickname: 'あなた', avatarEmoji: MY_RANKING_EMOJI, days: myDays, isMe: true },
  ];

  // 同着は自分を上に置く（buildRanking と同じ）。
  rows.sort((a, b) => b.days - a.days || (a.isMe ? -1 : b.isMe ? 1 : 0));

  const entries: StreakRankingEntry[] = rows.map((r, i) => ({ ...r, rank: i + 1 }));
  const me = entries.find((e) => e.isMe)!;
  const label = period === 'month' ? `${new Date().getMonth() + 1}月` : '累計';

  return { period, periodLabel: label, entries, me, participantCount: entries.length };
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

  // 今日/今週/今月・ストリーク・日別・月別・教材別・最近の履歴をまとめて返す。
  // 画面はこれ1本で描けるようにしてある（リクエストを増やさない）。
  //
  // 🔴 days=all は「最初の記録の日から今日まで」。/study-log がこれで呼び、
  //    カレンダーの月送りも期間タブも全部この1回の応答から切り出す。
  //    日数で切ると「タブを切り替えるたびに読み込み中へ戻る」が復活する。
  http.get('*/api/webcoach/study-stats/:userid', async ({ params, request }) => {
    await delay();
    const userId = userIdOf(params);
    const raw = new URL(request.url).searchParams.get('days');
    const daysParam = Number(raw);
    const days: number | 'all' =
      raw === 'all'
        ? 'all'
        : Number.isFinite(daysParam) && daysParam > 0
          ? Math.min(daysParam, MAX_STATS_DAYS)
          : DEFAULT_STATS_DAYS;
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
        // 🔴 手動追加には今週の累計スナップショットを付けない。
        //    過去日の記録に「記録した時点の今週の累計」を書くのは事実として誤り
        //    （表示用のスナップショットで集計には使わないので、無くて困らない）。
        weeklyTotalMinutesAtEnd:
          input.session.entrySource === 'manual'
            ? undefined
            : weekBefore + input.session.durationMinutes,
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

  // 保存済みの記録を後から直す（タイマーの止め忘れ・付け忘れの訂正）。
  // 🔴 検証も適用も utils/studyStats.ts の純関数に委ねる。ここに条件を書かないこと。
  //    画面も同じ関数で送信前に検証するので、文言が2種類にならない。
  http.patch('*/api/webcoach/study-activities/:userid/:activityId', async ({ params, request }) => {
    await delay(250);
    const userId = userIdOf(params);

    let patch: StudyActivityPatch;
    try {
      patch = (await request.json()) as StudyActivityPatch;
    } catch {
      return HttpResponse.json({ error: 'invalid body' }, { status: 400 });
    }

    const store = readStore(userId);
    const index = store.activities.findIndex((a) => a.id === params.activityId);
    if (index < 0) return HttpResponse.json({ error: 'not found' }, { status: 404 });

    const invalid = validateActivityPatch(store.activities[index], patch);
    if (invalid) return HttpResponse.json({ error: invalid }, { status: 400 });

    const next = applyActivityPatch(store.activities[index], patch);
    store.activities[index] = next;
    writeStore(store);
    return HttpResponse.json(next);
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

  // ストリークランキング（今月／累計の学習日数）。マイページと学習記録ページが使う。
  http.get('*/api/webcoach/study-ranking-streak/:userid', async ({ params, request }) => {
    await delay();
    const raw = new URL(request.url).searchParams.get('period');
    const period: StreakRankingPeriod = raw === 'total' ? 'total' : 'month';
    return HttpResponse.json(buildStreakRanking(userIdOf(params), period));
  }),

  // 学習時間ランキング（今週／今月）
  http.get('*/api/webcoach/study-ranking/:userid', async ({ params, request }) => {
    await delay();
    const raw = new URL(request.url).searchParams.get('period');
    const period: StudyRankingPeriod = raw === 'month' ? 'month' : 'week';
    return HttpResponse.json(buildRanking(userIdOf(params), period));
  }),

  // ★既存パスの実装差し替え。handlers.ts 側の固定モック（12日）は削除済み。
  //   ログイン日数ではなく「1日10分以上学習した日」の連続をストリークとして返す。
  http.get('*/api/webcoach/streak/:userid', async ({ params }) => {
    await delay(150);
    return HttpResponse.json(currentStreakInfo(userIdOf(params)));
  }),
];

export default studyActivityHandlers;
