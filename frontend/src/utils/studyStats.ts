/**
 * 学習アクティビティ → 表示用の集計値。すべて副作用のない純関数。
 * ============================================================
 * ここに集約している理由:
 *   1. MSWモックハンドラと画面の両方が同じ関数を呼ぶため
 *      （「集中ブースのストリークとマイページのストリークが違う」を構造的に防ぐ）。
 *      utils/learningPlanTemplate.ts が同じ理由で共有されているのと同じ作法。
 *   2. 実BFFに移すとき、そのままサーバ側に持っていけるため。
 *
 * 集計値を保存せず毎回導出しているのは、終了時の時間修正や記録の削除があると
 * サマリーの書き手が2つになって必ずズレるため。数千件のreduceはUIの予算に対して無視できる。
 *
 * 日付の扱い（ここを間違えると全指標が1日ずれる）:
 *   - 日の単位は「端末ローカル日」。toISOString().slice(0,10) は UTC 日付になり
 *     JSTの 00:00〜08:59 が前日に落ちるので絶対に使わない（date-fns の format を使う）。
 *   - 週は月曜始まり（hooks/useLearningSummary.ts と揃える）。
 *   - 1日の境界は 0 時。生活時間に合わせて 4 時始まりにしたくなったら
 *     DAY_BOUNDARY_HOUR だけ変えれば全指標が追随する。
 * ============================================================
 */
import {
  addDays,
  differenceInCalendarDays,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns';
import {
  ActiveStudySession,
  Achievement,
  CategoryStudyTotal,
  CourseStudyTotal,
  ManualStudyEntryInput,
  StudyActivity,
  StudyActivityInput,
  StudyActivityPatch,
  StudyCategory,
  StudyDayTotal,
  StudyFinishDraft,
  StudyMonthTotal,
  StudyPeriodTotal,
  StudySegmentTotal,
  StudyStatsSummary,
  StudyStreak,
  STUDY_CATEGORY_ORDER,
} from '../types/studyActivity';
import { StreakInfo, WeekActivity } from '../types/mypage';

/** 1日の合計がこの分数以上なら「学習した日」。ストリーク・カレンダーの唯一の閾値 */
export const STUDY_DAY_MIN_MINUTES = 10;

/** これ未満は記録しない。誤操作の数秒が1分として積むと「学習した日」が成立してしまう */
export const MIN_RECORDABLE_SECONDS = 60;

/** 1日の境界（0 = 0時始まり）。ここだけ変えれば全指標が追随する */
export const DAY_BOUNDARY_HOUR = 0;

/** 一時停止したまま／動かしたまま放置されたと見なす時間。黙って記録すると累計が壊れる */
export const STALE_SESSION_MS = 12 * 60 * 60 * 1000;

/**
 * 最後の操作からこの時間動きが無ければ「まだ学習していますか？」と確認する。
 * 🔴 短すぎると集中して読んでいる人に割り込む。長すぎると離席ぶんが記録に混ざる。
 *    STALE_SESSION_MS（12時間）はタブを閉じたまま日をまたいだ場合の最後の保険で、
 *    こちらが日常的に効く方の検知。
 */
export const IDLE_PROMPT_MS = 30 * 60 * 1000;

/**
 * 終了時に修正できる上限（実測 + この分数）。桁の打ち間違いを弾く。
 * 🔴 終了カード専用。実測のない手動追加に当てると常に 0 分上限になって使えないので、
 *    手動追加・後からの編集には MAX_MANUAL_MINUTES を使うこと。
 */
export const MAX_ADJUST_EXTRA_MINUTES = 240;

/** 1件の記録の下限。MIN_RECORDABLE_SECONDS（60秒）と整合させる */
export const MIN_ACTIVITY_MINUTES = 1;

/**
 * 手動追加・後からの編集で許す1件あたりの上限（分）。
 * 1日の大半を1セッションにするのは打ち間違いなので 10 時間で止める。
 */
export const MAX_MANUAL_MINUTES = 600;

/** フリーテキストの保存上限（localStorage 容量対策） */
export const TEXT_MAX_LENGTH = 500;

/**
 * カレンダーの濃淡の閾値（分）。L1 / L2 / L3 / L4 の下限。
 * 🔴 L1 の下限を STUDY_DAY_MIN_MINUTES にしてあるのが要。こうしておくと
 *    「段階ドットが1つでも付いている = 学習した日」が構造的に真になり、
 *    凡例の文言（「10分以上で学習した日」）と実装がずれない。
 */
export const STUDY_HEAT_THRESHOLDS = [STUDY_DAY_MIN_MINUTES, 30, 60, 120] as const;

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

// ---- 日付キー --------------------------------------------------------------

/** 端末ローカル日のキー（YYYY-MM-DD）。集計の基準はすべてこれ */
export function toLocalDateKey(d: Date | number | string): string {
  const base = typeof d === 'string' ? new Date(d) : new Date(d);
  if (DAY_BOUNDARY_HOUR > 0 && base.getHours() < DAY_BOUNDARY_HOUR) {
    return format(subDays(base, 1), 'yyyy-MM-dd');
  }
  return format(base, 'yyyy-MM-dd');
}

/** 月曜始まりの週初め */
export function weekStartOf(d: Date): Date {
  return startOfWeek(d, { weekStartsOn: 1 });
}

export function monthStartOf(d: Date): Date {
  return startOfMonth(d);
}

// ---- 実行中セッションの経過（3つの画面が同じ値を出すために共有する）--------

/**
 * 経過秒。ポモドーロでも打ち切らない（超過分を「+M:SS 超過」として見せるため）。
 * 放置による水増しは「目標到達で自動一時停止する」ことで防ぐ（hooks/useStudySession.ts）。
 */
export function sessionElapsedSeconds(s: ActiveStudySession, now: number = Date.now()): number {
  const end = s.pausedAt ?? now;
  return Math.max(0, Math.floor((end - s.startedAt) / 1000));
}

/** 残り秒。ポモドーロのみ。通常タイマーは数え上げなので残りの概念が無く null を返す */
export function sessionRemainingSeconds(
  s: ActiveStudySession,
  now: number = Date.now()
): number | null {
  if (s.mode !== 'pomodoro' || !s.targetMinutes) return null;
  return Math.max(0, s.targetMinutes * 60 - sessionElapsedSeconds(s, now));
}

export function hasReachedTarget(s: ActiveStudySession, now: number = Date.now()): boolean {
  if (s.mode !== 'pomodoro' || !s.targetMinutes) return false;
  return sessionElapsedSeconds(s, now) >= s.targetMinutes * 60;
}

/** 一時停止したまま／動かしたまま長時間放置されたセッションか（＝タイマーの消し忘れ） */
export function isStaleSession(s: ActiveStudySession, now: number = Date.now()): boolean {
  return now - (s.pausedAt ?? s.startedAt) > STALE_SESSION_MS;
}

/** 最後の操作から IDLE_PROMPT_MS 以上動きが無いか（＝離席したまま計測が続いている疑い） */
export function isIdleSession(s: ActiveStudySession, now: number = Date.now()): boolean {
  if (s.pausedAt !== null) return false;
  return now - s.lastActiveAt > IDLE_PROMPT_MS;
}

/**
 * 実行中セッションのカテゴリ別内訳（実測秒）。
 *
 * 🔴 区間の終わりは「閉じた区間なら endedAt、開いている区間なら end = pausedAt ?? now」で測る。
 *    セッション全体の経過（sessionElapsedSeconds）と同じ end を使うので、
 *    合計は必ず sessionElapsedSeconds と一致する。
 * 🔴 同じカテゴリの区間はまとめる（教材→AI→教材 なら教材は1行）。
 */
export function sessionSegmentTotals(
  s: ActiveStudySession,
  now: number = Date.now()
): StudySegmentTotal[] {
  const end = s.pausedAt ?? now;
  const acc = new Map<StudyCategory, number>();
  for (const seg of s.segments ?? []) {
    const segEnd = seg.endedAt ?? end;
    const seconds = Math.max(0, Math.floor((segEnd - seg.startedAt) / 1000));
    if (seconds <= 0) continue;
    acc.set(seg.category, (acc.get(seg.category) ?? 0) + seconds);
  }
  return STUDY_CATEGORY_ORDER.filter((c) => acc.has(c)).map((category) => ({
    category,
    seconds: acc.get(category) as number,
  }));
}

/**
 * 内訳の合計を目標秒ぴったりに合わせ直す。
 *
 * 終了カードでユーザーが分数を修正できるため、実測の内訳をそのまま残すと
 * 「学習時間 42分／内訳の合計 37分」という嘘が出る。durationMinutes を権威として
 * 比例配分し、端数は最大の区間に寄せて必ず一致させる。
 */
export function rescaleSegments(segments: StudySegmentTotal[], targetSeconds: number): StudySegmentTotal[] {
  const total = segments.reduce((sum, s) => sum + s.seconds, 0);
  if (segments.length === 0 || targetSeconds <= 0) return [];
  if (total <= 0) return [{ category: segments[0].category, seconds: targetSeconds }];

  const scaled = segments.map((s) => ({ ...s, seconds: Math.round((s.seconds / total) * targetSeconds) }));
  const diff = targetSeconds - scaled.reduce((sum, s) => sum + s.seconds, 0);
  if (diff !== 0) {
    let largest = 0;
    for (let i = 1; i < scaled.length; i += 1) if (scaled[i].seconds > scaled[largest].seconds) largest = i;
    scaled[largest] = { ...scaled[largest], seconds: Math.max(0, scaled[largest].seconds + diff) };
  }
  return scaled.filter((s) => s.seconds > 0);
}

/**
 * 記録1件のカテゴリ別内訳を読む。
 * segments を持たない古い記録は、教材が付いていれば教材・無ければその他として扱う
 * （旧実装で計測できたのは集中ブースと教材ページだけなので実態に一番近い）。
 */
export function activitySegments(a: StudyActivity): StudySegmentTotal[] {
  const seconds = a.session.durationMinutes * 60;
  if (a.session.segments && a.session.segments.length > 0) return a.session.segments;
  return [{ category: a.course ? 'material' : 'other', seconds }];
}

/**
 * 内訳を「分」で表示するための配分。
 *
 * 🔴 秒をそのまま Math.round(s/60) すると、22秒を4カテゴリに分けた直後のような
 *    短いセッションで「教材 0分 / AIコーチ 0分 / 復習 0分 / その他 0分」という
 *    情報ゼロの行が並ぶ。最大剰余法で分を配ることで、
 *      - 表示された分の合計が totalMinutes と必ず一致し、
 *      - 端数だけの区間は 0分 になって（呼び出し側で）消える
 *    という2つを同時に満たす。
 * 🔴 0分の行は呼び出し側で捨てる。残りが1行だけなら内訳を出す意味が無い
 *    （上に出ている学習時間と同じことを2回言うだけになる）。
 */
export function segmentMinutes(
  segments: StudySegmentTotal[],
  totalMinutes: number
): { category: StudyCategory; minutes: number }[] {
  const totalSeconds = segments.reduce((sum, s) => sum + s.seconds, 0);
  if (segments.length === 0 || totalSeconds <= 0 || totalMinutes <= 0) return [];

  const exact = segments.map((s) => ({ category: s.category, raw: (s.seconds / totalSeconds) * totalMinutes }));
  const out = exact.map((e) => ({ category: e.category, minutes: Math.floor(e.raw) }));
  let remainder = totalMinutes - out.reduce((sum, o) => sum + o.minutes, 0);

  // 端数の大きい順に1分ずつ配る
  const order = exact
    .map((e, i) => ({ i, frac: e.raw - Math.floor(e.raw) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    out[i] = { ...out[i], minutes: out[i].minutes + 1 };
    remainder -= 1;
  }
  return out;
}

/** 表示用の内訳。0分の行を落とし、2行以上残らなければ空を返す（＝出さない） */
export function displaySegments(
  segments: StudySegmentTotal[],
  totalMinutes: number
): { category: StudyCategory; minutes: number }[] {
  const rows = segmentMinutes(segments, totalMinutes).filter((r) => r.minutes > 0);
  return rows.length > 1 ? rows : [];
}

/** カテゴリ別の累計。courseTotals と同じ考え方で、0分のカテゴリは含めない */
export function categoryTotals(activities: StudyActivity[]): CategoryStudyTotal[] {
  const acc = new Map<StudyCategory, { seconds: number; sessionCount: number }>();
  for (const a of activities) {
    for (const seg of activitySegments(a)) {
      const cur = acc.get(seg.category) ?? { seconds: 0, sessionCount: 0 };
      acc.set(seg.category, { seconds: cur.seconds + seg.seconds, sessionCount: cur.sessionCount + 1 });
    }
  }
  return STUDY_CATEGORY_ORDER.filter((c) => acc.has(c))
    .map((category) => {
      const v = acc.get(category) as { seconds: number; sessionCount: number };
      return { category, minutes: Math.round(v.seconds / 60), sessionCount: v.sessionCount };
    })
    .filter((c) => c.minutes > 0);
}

/** 円形ダイヤルの塗り割合（0..1）。通常タイマーは分母が無いので 60秒周期の秒針にする */
export function dialRatio(s: ActiveStudySession | null, elapsedSeconds: number): number {
  if (!s) return 0;
  if (s.mode === 'pomodoro' && s.targetMinutes) {
    const total = s.targetMinutes * 60;
    return Math.max(0, Math.min(1, (total - elapsedSeconds) / total));
  }
  return (elapsedSeconds % 60) / 60;
}

// ---- 日別 ------------------------------------------------------------------

export function dayTotalMap(activities: StudyActivity[]): Record<string, StudyDayTotal> {
  const map: Record<string, StudyDayTotal> = {};
  for (const a of activities) {
    const key = a.localDate;
    const minutes = a.session.durationMinutes;
    const cur = map[key];
    if (cur) {
      cur.minutes += minutes;
      cur.sessionCount += 1;
      cur.longestMinutes = Math.max(cur.longestMinutes, minutes);
      cur.isStudyDay = cur.minutes >= STUDY_DAY_MIN_MINUTES;
    } else {
      map[key] = {
        date: key,
        minutes,
        sessionCount: 1,
        longestMinutes: minutes,
        isStudyDay: minutes >= STUDY_DAY_MIN_MINUTES,
      };
    }
  }
  return map;
}

/** from..to の欠損日を 0 で埋めた連続配列。バーグラフとカレンダーが両方これを使う */
export function dailyTotals(activities: StudyActivity[], from: Date, to: Date): StudyDayTotal[] {
  const map = dayTotalMap(activities);
  const out: StudyDayTotal[] = [];
  let cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const last = toLocalDateKey(to);
  // 日数で回すのではなくキー比較で止める（DSTのある地域でも1日ずれない）
  for (let guard = 0; guard < 3650; guard += 1) {
    const key = format(cursor, 'yyyy-MM-dd');
    out.push(
      map[key] ?? { date: key, minutes: 0, sessionCount: 0, longestMinutes: 0, isStudyDay: false }
    );
    if (key >= last) break;
    cursor = addDays(cursor, 1);
  }
  return out;
}

/**
 * カレンダーの濃淡の段階。0 = 記録なし、1..4 = STUDY_HEAT_THRESHOLDS の各段。
 * 1〜9分（閾値未満）は 0 と区別したいので、呼び出し側が minutes > 0 で見分ける。
 */
export function heatLevelOf(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes < STUDY_HEAT_THRESHOLDS[0]) return 0;
  if (minutes < STUDY_HEAT_THRESHOLDS[1]) return 1;
  if (minutes < STUDY_HEAT_THRESHOLDS[2]) return 2;
  if (minutes < STUDY_HEAT_THRESHOLDS[3]) return 3;
  return 4;
}

/** 最古の記録の localDate。1件も無ければ null。カレンダーの遡り下限になる */
export function firstStudyDateOf(activities: StudyActivity[]): string | null {
  let min: string | null = null;
  for (const a of activities) {
    if (min === null || a.localDate < min) min = a.localDate;
  }
  return min;
}

/**
 * 月別の合計。最古の記録の月から今月までを、記録の無い月も 0 で埋めて連続させる。
 * 🔴 dailyTotals をクライアントで畳んで作らないこと。dailyTotals は days で窓が
 *    切られているので、35日ぶんしか取っていないマイページで同じ計算をすると
 *    「1ヶ月だけの月別グラフ」になる。studyDays の閾値判定も画面に持ち出さない。
 */
export function monthlyTotals(activities: StudyActivity[], today: Date = new Date()): StudyMonthTotal[] {
  const first = firstStudyDateOf(activities);
  if (!first) return [];

  const dayMap = dayTotalMap(activities);
  const acc = new Map<string, StudyMonthTotal>();
  for (const day of Object.values(dayMap)) {
    const month = day.date.slice(0, 7);
    const cur = acc.get(month);
    if (cur) {
      cur.minutes += day.minutes;
      cur.sessionCount += day.sessionCount;
      if (day.isStudyDay) cur.studyDays += 1;
    } else {
      acc.set(month, {
        month,
        minutes: day.minutes,
        sessionCount: day.sessionCount,
        studyDays: day.isStudyDay ? 1 : 0,
      });
    }
  }

  // 欠損月を 0 で埋める。月の桁上がりは Date に任せる（12月→翌1月を手で書かない）
  const out: StudyMonthTotal[] = [];
  const lastMonth = format(monthStartOf(today), 'yyyy-MM');
  let cursor = new Date(Number(first.slice(0, 4)), Number(first.slice(5, 7)) - 1, 1);
  for (let guard = 0; guard < 600; guard += 1) {
    const key = format(cursor, 'yyyy-MM');
    out.push(acc.get(key) ?? { month: key, minutes: 0, sessionCount: 0, studyDays: 0 });
    if (key >= lastMonth) break;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return out;
}

/** 閾値を満たす「学習した日」のキーを昇順で返す */
export function studyDayKeys(activities: StudyActivity[]): string[] {
  const map = dayTotalMap(activities);
  return Object.values(map)
    .filter((d) => d.isStudyDay)
    .map((d) => d.date)
    .sort();
}

// ---- 期間合計 --------------------------------------------------------------

export function periodTotal(
  activities: StudyActivity[],
  fromKey: string,
  toKey: string
): StudyPeriodTotal {
  let minutes = 0;
  let sessionCount = 0;
  let longestMinutes = 0;
  for (const a of activities) {
    if (a.localDate < fromKey || a.localDate > toKey) continue;
    minutes += a.session.durationMinutes;
    sessionCount += 1;
    longestMinutes = Math.max(longestMinutes, a.session.durationMinutes);
  }
  return { minutes, sessionCount, longestMinutes };
}

// ---- ストリーク ------------------------------------------------------------

export function computeStreak(activities: StudyActivity[], today: Date = new Date()): StudyStreak {
  const keys = studyDayKeys(activities);
  const keySet = new Set(keys);
  const todayKey = toLocalDateKey(today);
  const yesterdayKey = toLocalDateKey(subDays(today, 1));

  // 今日ぶんが未成立でも、昨日が成立していれば連続は「生きている」。
  // today 起点だけにすると毎朝0時にストリークが0に見えて、受講生の信頼を失う。
  let cursor: Date | null = keySet.has(todayKey)
    ? today
    : keySet.has(yesterdayKey)
      ? subDays(today, 1)
      : null;
  let currentDays = 0;
  while (cursor && keySet.has(toLocalDateKey(cursor))) {
    currentDays += 1;
    cursor = subDays(cursor, 1);
  }

  // 過去最長は昇順キーを走査して、差が1日を超えたところで切る
  let best = 0;
  let run = 0;
  keys.forEach((k, i) => {
    run =
      i > 0 && differenceInCalendarDays(new Date(k), new Date(keys[i - 1])) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });

  const map = dayTotalMap(activities);
  const monthPrefix = format(today, 'yyyy-MM');

  return {
    currentDays,
    bestDays: Math.max(best, currentDays),
    monthStudyDays: keys.filter((k) => k.startsWith(monthPrefix)).length,
    todayAchieved: keySet.has(todayKey),
    todayMinutes: map[todayKey]?.minutes ?? 0,
    thresholdMinutes: STUDY_DAY_MIN_MINUTES,
  };
}

/**
 * 既存 StreakInfo（マイページの契約）へ写す。週の月〜日ラベルを作るのはここだけ。
 * これがあることで、マイページと集中ブースが同じ計算結果を見る。
 */
export function toStreakInfo(activities: StudyActivity[], today: Date = new Date()): StreakInfo {
  const streak = computeStreak(activities, today);
  const map = dayTotalMap(activities);
  const monday = weekStartOf(today);
  const week: WeekActivity[] = WEEKDAY_LABELS.map((label, i) => {
    const key = format(addDays(monday, i), 'yyyy-MM-dd');
    return { label, studied: !!map[key]?.isStudyDay };
  });
  return { days: streak.currentDays, best: streak.bestDays, week };
}

// ---- 教材別 ----------------------------------------------------------------

export function courseTotals(activities: StudyActivity[]): CourseStudyTotal[] {
  const map = new Map<string, CourseStudyTotal>();
  for (const a of activities) {
    const courseId = a.course?.courseId ?? null;
    const key = String(courseId);
    const cur = map.get(key);
    if (cur) {
      cur.minutes += a.session.durationMinutes;
      cur.sessionCount += 1;
      if (a.endedAt > cur.lastStudiedAt) cur.lastStudiedAt = a.endedAt;
    } else {
      map.set(key, {
        courseId,
        courseTitle: a.course?.courseTitle ?? '教材を指定しない',
        minutes: a.session.durationMinutes,
        sessionCount: 1,
        lastStudiedAt: a.endedAt,
      });
    }
  }
  // tsconfig の target が ES5 なので Map のイテレータは Array.from で受ける
  return Array.from(map.values()).sort((x, y) => y.minutes - x.minutes);
}

// ---- まとめ ----------------------------------------------------------------

const RECENT_LIMIT = 5;

/** 新しい順（occurredAt 降順） */
export function sortByOccurredDesc(activities: StudyActivity[]): StudyActivity[] {
  return [...activities].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

/**
 * @param days 直近何日ぶんの dailyTotals を返すか。'all' なら最初の記録の日から今日まで。
 *   🔴 /study-log は 'all' で呼ぶ。カレンダーの月送り・月別グラフ・期間タブを
 *      1回の取得で全部賄うためで、これを日数で切ると「タブを切り替えるたびに
 *      読み込み中に戻る」が復活する。マイページは既定の 35 のまま。
 */
export function summarize(
  activities: StudyActivity[],
  today: Date = new Date(),
  days: number | 'all' = 35
): StudyStatsSummary {
  const todayKey = toLocalDateKey(today);
  const weekStartKey = format(weekStartOf(today), 'yyyy-MM-dd');
  const lastWeekStart = subDays(weekStartOf(today), 7);
  const lastWeekEndKey = format(subDays(weekStartOf(today), 1), 'yyyy-MM-dd');
  const monthStartKey = format(monthStartOf(today), 'yyyy-MM-dd');
  const firstStudyDate = firstStudyDateOf(activities);

  // 'all' のときは最初の記録の日から。1件も無ければ今日1日ぶん（空配列にしない —
  // グラフ側が「今日の0分」を描けなくなる）
  const dailyFrom =
    days === 'all'
      ? firstStudyDate
        ? new Date(
            Number(firstStudyDate.slice(0, 4)),
            Number(firstStudyDate.slice(5, 7)) - 1,
            Number(firstStudyDate.slice(8, 10))
          )
        : today
      : subDays(today, Math.max(0, days - 1));

  return {
    today: periodTotal(activities, todayKey, todayKey),
    week: periodTotal(activities, weekStartKey, todayKey),
    lastWeek: periodTotal(activities, format(lastWeekStart, 'yyyy-MM-dd'), lastWeekEndKey),
    month: periodTotal(activities, monthStartKey, todayKey),
    allTime: periodTotal(activities, firstStudyDate ?? todayKey, todayKey),
    streak: computeStreak(activities, today),
    dailyTotals: dailyTotals(activities, dailyFrom, today),
    byCourse: courseTotals(activities),
    byCategory: categoryTotals(activities),
    recent: sortByOccurredDesc(activities).slice(0, RECENT_LIMIT),
    firstStudyDate,
    // days に関係なく常に全期間。高々数十行なので、35日で呼ぶマイページでも負担にならない
    monthlyTotals: monthlyTotals(activities, today),
    generatedAt: new Date().toISOString(),
  };
}

// ---- 記録の組み立て --------------------------------------------------------

let idCounter = 0;

/** `sa-<startedAtMs>-<base36>`。同一msで連続生成しても衝突しないようカウンタを混ぜる */
export function newActivityId(startedAtMs: number): string {
  idCounter = (idCounter + 1) % 1296; // 36^2
  return `sa-${startedAtMs}-${idCounter.toString(36).padStart(2, '0')}`;
}

export function clampText(v: string | null | undefined): string | null {
  const trimmed = (v ?? '').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, TEXT_MAX_LENGTH);
}

/** 下書き → POST body。hook とモックのシードが同じ組み立てを使う */
export function buildActivityInput(
  draft: StudyFinishDraft,
  overrides: { progressPercentAtEnd?: number } = {}
): StudyActivityInput {
  const { snapshot } = draft;
  const measuredMinutes = Math.round(draft.measuredSeconds / 60);
  const course = snapshot.course
    ? {
        ...snapshot.course,
        progressPercentAtEnd:
          overrides.progressPercentAtEnd ?? snapshot.course.progressPercentAtEnd,
      }
    : null;

  return {
    id: draft.activityId,
    kind: 'study_session',
    occurredAt: snapshot.endedAt,
    startedAt: snapshot.startedAt,
    endedAt: snapshot.endedAt,
    localDate: snapshot.localDate,
    endLocalDate: snapshot.endLocalDate,
    timezoneOffsetMinutes: snapshot.timezoneOffsetMinutes,
    course,
    session: {
      mode: snapshot.mode,
      targetMinutes: snapshot.targetMinutes,
      durationMinutes: Math.max(1, draft.actualMinutes),
      measuredSeconds: draft.measuredSeconds,
      adjusted: draft.actualMinutes !== measuredMinutes,
      pausedCount: snapshot.pausedCount,
      pausedSeconds: snapshot.pausedSeconds,
      completedTarget: snapshot.completedTarget,
      goalText: clampText(draft.goalText),
      contentNote: clampText(draft.contentNote),
      memo: clampText(draft.memo),
      achievement: draft.achievement,
      // 🔴 実測の内訳をそのまま残さず、確定した durationMinutes に合わせ直す。
      //    そうしないと「学習時間 42分／内訳の合計 37分」という嘘が記録に残る。
      segments: rescaleSegments(snapshot.segments, Math.max(1, draft.actualMinutes) * 60),
    },
    visibility: 'private',
  };
}

/** 稼働中セッション → 終了カードの下書き。prepareFinish と「放置セッションの後始末」が共有する */
export function buildFinishDraft(
  session: ActiveStudySession,
  endAtMs: number = Date.now()
): StudyFinishDraft {
  const end = session.pausedAt ?? endAtMs;
  const measuredSeconds = Math.max(0, Math.floor((end - session.startedAt) / 1000));
  const startedAtIso = new Date(session.startedAt).toISOString();
  const endedAtIso = new Date(end).toISOString();

  return {
    activityId: session.activityId,
    measuredSeconds,
    actualMinutes: Math.max(1, Math.round(measuredSeconds / 60)),
    goalText: session.goalText ?? '',
    contentNote: '',
    memo: '',
    achievement: null,
    snapshot: {
      startedAt: startedAtIso,
      endedAt: endedAtIso,
      localDate: toLocalDateKey(session.startedAt),
      endLocalDate: toLocalDateKey(end),
      timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
      course: session.courseId
        ? {
            courseId: session.courseId,
            courseTitle: session.courseTitle ?? '',
            lessonId: session.lessonId,
            lessonTitle: session.lessonTitle,
            progressPercentAtStart: session.progressPercentAtStart,
          }
        : null,
      mode: session.mode,
      targetMinutes: session.targetMinutes,
      pausedCount: session.pausedCount,
      pausedSeconds: Math.round(session.pausedTotalMs / 1000),
      completedTarget: session.targetReachedAt !== null,
      // 実測のまま持つ。durationMinutes への配分は buildActivityInput が行う
      // （終了カードで分数を変えるたびに配分をやり直せるよう、元の比率を残しておく）
      segments: sessionSegmentTotals(session, end),
    },
  };
}

// ---- 記録の編集・手動追加 --------------------------------------------------
// 🔴 検証も適用もここに置く。MSW ハンドラにも画面にも書かないこと
//    （書くと「モックでは通るが画面では弾かれる」が起きる）。

/** 手動で足された記録か。entrySource が無い古い行のために measuredSeconds も見る */
export function isManualEntry(a: StudyActivity): boolean {
  return a.session.entrySource === 'manual' || a.session.measuredSeconds === 0;
}

/**
 * 保存後に編集された記録か。
 * 🔴 adjusted では判定しない。あれは「終了カードで実測と違う分数を確定した」印で、
 *    後から書き換えたこととは別の話（types/studyActivity.ts の対応表を参照）。
 */
export function isEditedEntry(a: StudyActivity): boolean {
  return a.updatedAt !== a.createdAt;
}

/** YYYY-MM-DD → ローカルの Date（正午）。文字列から Date を起こす唯一の入口 */
function dateFromKey(key: string): Date {
  return new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)), 12, 0, 0, 0);
}

function isDateKey(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(dateFromKey(v).getTime());
}

/**
 * 日付の付け替えに伴って動く時刻をまとめて出す。
 * 🔴 localDate だけ書き換えないこと。occurredAt は「タイムラインの並び順の唯一の基準」
 *    なので、日付とずれると日別の一覧が並ばなくなる。
 * 🔴 toISOString().slice(0,10) を使わない（UTC 日付になり JST の深夜が前日に落ちる）。
 */
export function shiftActivityDates(
  a: StudyActivity,
  nextLocalDate: string
): Pick<StudyActivity, 'startedAt' | 'endedAt' | 'occurredAt' | 'localDate' | 'endLocalDate'> {
  const shift = differenceInCalendarDays(dateFromKey(nextLocalDate), dateFromKey(a.localDate));
  if (shift === 0) {
    return {
      startedAt: a.startedAt,
      endedAt: a.endedAt,
      occurredAt: a.occurredAt,
      localDate: a.localDate,
      endLocalDate: a.endLocalDate,
    };
  }
  const started = addDays(new Date(a.startedAt), shift);
  const ended = addDays(new Date(a.endedAt), shift);
  return {
    startedAt: started.toISOString(),
    endedAt: ended.toISOString(),
    // occurredAt = endedAt（型のコメントどおり）。ずらしても同じ関係を保つ
    occurredAt: ended.toISOString(),
    localDate: nextLocalDate,
    endLocalDate: toLocalDateKey(ended),
  };
}

/** 分数の範囲チェック。編集と手動追加で同じ文言を出すために共有する */
function minutesError(minutes: number): string | null {
  if (!Number.isFinite(minutes) || !Number.isInteger(minutes)) return '学習時間は分単位の整数で入力してください';
  if (minutes < MIN_ACTIVITY_MINUTES) return `学習時間は${MIN_ACTIVITY_MINUTES}分以上にしてください`;
  if (minutes > MAX_MANUAL_MINUTES) return `学習時間は${MAX_MANUAL_MINUTES}分（${MAX_MANUAL_MINUTES / 60}時間）までにしてください`;
  return null;
}

function dateError(localDate: string, today: Date): string | null {
  if (!isDateKey(localDate)) return '日付の形式が正しくありません';
  if (localDate > toLocalDateKey(today)) return '未来の日付には記録できません';
  return null;
}

/** 手動追加の検証。問題なければ null、あれば画面にそのまま出せる日本語を返す */
export function validateManualEntry(
  v: ManualStudyEntryInput,
  today: Date = new Date()
): string | null {
  if (!v.id) return '記録IDがありません';
  return dateError(v.localDate, today) ?? minutesError(v.durationMinutes);
}

/** 編集の検証。触っていない項目は見ない（undefined = 変更なし） */
export function validateActivityPatch(
  cur: StudyActivity,
  p: StudyActivityPatch,
  today: Date = new Date()
): string | null {
  if (p.durationMinutes !== undefined) {
    const e = minutesError(p.durationMinutes);
    if (e) return e;
  }
  if (p.localDate !== undefined) {
    const e = dateError(p.localDate, today);
    if (e) return e;
  }
  return null;
}

/**
 * パッチを当てた新しい記録を返す（元は変更しない）。
 *
 * 🔴 durationMinutes が変わったら必ず segments を配分し直す。そうしないと
 *    「学習時間 42分／内訳の合計 37分」という嘘が残る（buildActivityInput と同じ理由）。
 *    segments を持たない古い行は activitySegments が course から1本合成するので、
 *    そちらも「内訳の合計 = durationMinutes*60」を満たしたまま移行できる。
 * 🔴 measuredSeconds / mode / pausedCount などは触らない。adjusted だけは
 *    「durationMinutes が実測と違うか」の定義どおり計算し直す。
 */
export function applyActivityPatch(
  cur: StudyActivity,
  p: StudyActivityPatch,
  now: Date = new Date()
): StudyActivity {
  const durationMinutes =
    p.durationMinutes !== undefined ? Math.max(MIN_ACTIVITY_MINUTES, p.durationMinutes) : cur.session.durationMinutes;
  const dates = p.localDate !== undefined ? shiftActivityDates(cur, p.localDate) : null;
  const measuredMinutes = Math.round(cur.session.measuredSeconds / 60);
  const course = p.course !== undefined ? p.course : cur.course;

  /*
   * 配分し直す元の内訳。
   * 🔴 実測の内訳がある行は、教材を付け外ししてもカテゴリ構成を触らない。
   *    あれは「そのとき何をしていたか」の実測であって、course から導く値ではない。
   * 🔴 内訳を持たない古い行だけは activitySegments が course から1本合成するので、
   *    合成には**新しい** course を使う。cur を渡すと、教材を外したのに
   *    内訳が material のまま残る。
   */
  const baseSegments =
    cur.session.segments && cur.session.segments.length > 0
      ? cur.session.segments
      : [{ category: (course ? 'material' : 'other') as StudyCategory, seconds: durationMinutes * 60 }];

  return {
    ...cur,
    ...(dates ?? {}),
    course,
    session: {
      ...cur.session,
      durationMinutes,
      adjusted: durationMinutes !== measuredMinutes,
      goalText: p.goalText !== undefined ? clampText(p.goalText) : cur.session.goalText,
      contentNote: p.contentNote !== undefined ? clampText(p.contentNote) : cur.session.contentNote,
      memo: p.memo !== undefined ? clampText(p.memo) : cur.session.memo,
      achievement: p.achievement !== undefined ? p.achievement : cur.session.achievement,
      segments: rescaleSegments(baseSegments, durationMinutes * 60),
    },
    // 編集済みの印はこれ（isEditedEntry）。専用フィールドを増やさない
    updatedAt: now.toISOString(),
  };
}

/**
 * 手動追加 → POST body。
 *
 * 🔴 StudyActivityInput をここで直接組み立てず buildActivityInput に委譲する。
 *    組み立てが2箇所に増えると clampText の適用漏れ・rescaleSegments の呼び忘れが
 *    起きる場所ができる。
 *
 * 時刻の決め方（決定的にしないと日別の一覧の並びが記録するたびに変わる）:
 *   その日が今日なら endedAt = 今、過去日なら endedAt = その日の 12:00。
 *   startedAt = endedAt - durationMinutes。
 */
export function buildManualActivityInput(
  v: ManualStudyEntryInput,
  now: Date = new Date()
): StudyActivityInput {
  const minutes = Math.max(MIN_ACTIVITY_MINUTES, v.durationMinutes);
  const isToday = v.localDate === toLocalDateKey(now);
  const ended = isToday ? new Date(now) : dateFromKey(v.localDate);
  const started = new Date(ended.getTime() - minutes * 60_000);

  const input = buildActivityInput({
    activityId: v.id,
    // 計測していないので 0。isManualEntry のフォールバック判定もこれを見る
    measuredSeconds: 0,
    actualMinutes: minutes,
    goalText: v.goalText ?? '',
    contentNote: v.contentNote ?? '',
    memo: v.memo ?? '',
    achievement: v.achievement ?? null,
    snapshot: {
      startedAt: started.toISOString(),
      endedAt: ended.toISOString(),
      localDate: v.localDate,
      endLocalDate: toLocalDateKey(ended),
      timezoneOffsetMinutes: -now.getTimezoneOffset(),
      course: v.course,
      // 計測ではないが mode は必須。'freeform' を入れる
      // （StudySessionMode に 'manual' を足すとタイマーUI全体に波及するため）
      mode: 'freeform',
      pausedCount: 0,
      pausedSeconds: 0,
      completedTarget: false,
      // 内訳は course の有無から1本だけ。rescaleSegments が分数に合わせる
      segments: [{ category: v.course ? 'material' : 'other', seconds: minutes * 60 }],
    },
  });

  return { ...input, session: { ...input.session, entrySource: 'manual' } };
}

/** 手動追加の記録ID。newActivityId と同じ形にして、保存側の扱いを1つに保つ */
export function newManualActivityId(atMs: number = Date.now()): string {
  return newActivityId(atMs);
}

// ---- 表示用の書式（画面とモックのシードが共有する）------------------------

export function formatMinutesHM(min: number): string {
  const safe = Math.max(0, Math.round(min));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h > 0) return m > 0 ? `${h}時間${m}分` : `${h}時間`;
  return `${m}分`;
}

/**
 * formatMinutesHM と同じ値を、数字と単位に割って返す。
 * マイページのサマリー帯だけが使う。あそこは「3」「23」を30px、「時間」「分」を20pxで組むため、
 * 1本の文字列だと単位まで大きくなって数字が読み取りにくくなる。
 * 表示内容そのものは formatMinutesHM と一致させること（丸めもここに揃えてある）。
 */
export function splitMinutesHM(min: number): { value: string; unit: string }[] {
  const safe = Math.max(0, Math.round(min));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h > 0) {
    return m > 0
      ? [{ value: String(h), unit: '時間' }, { value: String(m), unit: '分' }]
      : [{ value: String(h), unit: '時間' }];
  }
  return [{ value: String(m), unit: '分' }];
}

/** M:SS。ポモドーロの残り時間 */
export function formatMMSS(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** H:MM:SS。通常タイマーの経過時間（1時間を超えても読める） */
export function formatHMS(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function achievementOf(v: string | null | undefined): Achievement | null {
  return v === 'low' || v === 'mid' || v === 'high' ? v : null;
}
