/**
 * 推移グラフの系列づくり。副作用のない純関数。
 * ============================================================
 * StudyRecordPanel から切り出した。描画（div の高さ・SVG の polyline）と
 * 「どの日をどのバーに束ねるか」が同じ関数に同居していると、期間を増やすたびに
 * 描画側の分岐まで膨らむため。
 *
 * 🔴 再フェッチしない。stats.dailyTotals（/study-log では days='all' で取った
 *    受講開始日〜今日ぶん）を切り出すだけ。期間タブを押すたびにリクエストすると、
 *    切り替えのたびに画面が「読み込み中」に戻り、しかも同じ日を別のリクエストで
 *    2回数えることになる。
 *
 * 🔴 「学習した日」の判定（isStudyDay）は utils/studyStats.ts が付けた値を
 *    そのまま使う。閾値をここで再実装しない。
 * ============================================================
 */
import { StudyDayTotal } from '../../types/studyActivity';
import { formatMinutesHM, toLocalDateKey, weekStartOf } from '../../utils/studyStats';

export type RangeKey = '1w' | '30d' | '3m' | '6m' | 'month';

export const TREND_RANGES: { key: RangeKey; label: string; totalLabel: string }[] = [
  { key: '1w', label: '1週間', totalLabel: 'この週の学習時間' },
  { key: '30d', label: '30日間', totalLabel: '直近30日の学習時間' },
  { key: '3m', label: '3ヶ月', totalLabel: '直近3ヶ月の学習時間' },
  { key: '6m', label: '6ヶ月', totalLabel: '直近6ヶ月の学習時間' },
  { key: 'month', label: '月別', totalLabel: '表示中の期間の学習時間' },
];

/** 月別タブで出す最大の本数。これを超える受講期間でも横に潰れないところで止める */
const MONTH_BARS = 13;

export interface TrendBar {
  key: string;
  /** X軸ラベル。空文字なら間引く */
  x: string;
  /** 棒の上に出す値ラベル。null なら出さない */
  label: string | null;
  minutes: number;
  isToday: boolean;
  isFuture: boolean;
  tip: string;
}

export interface TrendSeries {
  bars: TrendBar[];
  /** 期間合計と「学習した日数」を数えるための日別。バーが週/月に束ねられていても日で持つ */
  days: StudyDayTotal[];
  /** 直前の同じ長さの期間の合計。前期間比を出すため。0 なら比較を出さない */
  prevMinutes: number;
  note: string;
  /** 30日タブだけ7日移動平均を重ねる。それ以外は null */
  movingAverage: number[] | null;
  /** 週送りで1つ前へ行けるか（1週間タブのみ） */
  canGoBack: boolean;
  /** 前期間比を出すか。3ヶ月以上は「直前の3ヶ月」が取得範囲外になりがちなので出さない */
  showDelta: boolean;
}

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

const EMPTY_DAY = (date: string): StudyDayTotal => ({
  date,
  minutes: 0,
  sessionCount: 0,
  longestMinutes: 0,
  isStudyDay: false,
});

function indexOf(daily: StudyDayTotal[]): Map<string, StudyDayTotal> {
  return new Map(daily.map((d) => [d.date, d]));
}

function dateKeysBetween(start: Date, count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return toLocalDateKey(d);
  });
}

/** 週バケット（月曜起点）。3ヶ月=13本 / 6ヶ月=26本 で共有する */
function weekBuckets(
  map: Map<string, StudyDayTotal>,
  today: Date,
  weeks: number,
  labelEvery: number
): { bars: TrendBar[]; days: StudyDayTotal[] } {
  const todayKey = toLocalDateKey(today);
  const thisWeekStart = weekStartOf(today);
  const starts = Array.from({ length: weeks }, (_, i) => {
    const s = new Date(thisWeekStart);
    s.setDate(thisWeekStart.getDate() - (weeks - 1 - i) * 7);
    return s;
  });
  const perWeek = starts.map((s) => dateKeysBetween(s, 7).map((k) => map.get(k) ?? EMPTY_DAY(k)));

  const bars = starts.map((s, i): TrendBar => {
    const minutes = perWeek[i].reduce((sum, d) => sum + d.minutes, 0);
    const e = new Date(s);
    e.setDate(s.getDate() + 6);
    return {
      key: toLocalDateKey(s),
      x: i % labelEvery === 0 ? `${s.getMonth() + 1}/${s.getDate()}` : '',
      label: null,
      minutes,
      isToday: i === weeks - 1,
      isFuture: false,
      tip: `${s.getMonth() + 1}/${s.getDate()}〜${e.getMonth() + 1}/${e.getDate()} ${formatMinutesHM(minutes)}`,
    };
  });

  // 期間合計は「今日まで」で数える。今週の未来の日を足すと合計が水増しになる
  const days = perWeek.flat().filter((d) => d.date <= todayKey);
  return { bars, days };
}

/**
 * 月バケット。受講開始月〜今月を新しい側から最大 MONTH_BARS 本。
 * daily は days='all' で取った全期間ぶんが前提（35日ぶんしか無いマイページで
 * 呼ぶと1〜2本しか出ないので、月別タブは /study-log 専用と考えること）。
 */
function monthBuckets(
  daily: StudyDayTotal[],
  today: Date
): { bars: TrendBar[]; days: StudyDayTotal[] } {
  const todayKey = toLocalDateKey(today);
  const thisMonth = todayKey.slice(0, 7);

  const acc = new Map<string, StudyDayTotal[]>();
  for (const d of daily) {
    const m = d.date.slice(0, 7);
    const cur = acc.get(m);
    if (cur) cur.push(d);
    else acc.set(m, [d]);
  }
  // 今月が1日も無い（=今月まだ記録が無い）ときも棒を立てる。空欄にすると
  // 「今月のぶんが読み込めていない」ように見える
  if (!acc.has(thisMonth)) acc.set(thisMonth, []);

  const months = Array.from(acc.keys()).sort().slice(-MONTH_BARS);
  let prevYear = '';

  const bars = months.map((m, i): TrendBar => {
    const inMonth = acc.get(m) ?? [];
    const minutes = inMonth.reduce((sum, d) => sum + d.minutes, 0);
    const year = m.slice(0, 4);
    const monthNum = Number(m.slice(5, 7));
    const yearChanged = year !== prevYear;
    prevYear = year;

    /*
     * ラベルの出し方。
     * ・年が変わる月は必ず出す（「2026 1月」）。ここを間引くと年の切れ目が読めない
     * ・9本を超えたら、それ以外は1つおきに間引く（13本すべてに出すと潰れる）
     * ・最後（今月）は必ず出す。右端が無名だと「どこまでの話か」が分からない
     */
    const isLast = i === months.length - 1;
    const dense = months.length > 9;
    const show = yearChanged || isLast || !dense || i % 2 === 0;

    return {
      key: m,
      x: show ? (yearChanged ? `${year} ${monthNum}月` : `${monthNum}月`) : '',
      label: null,
      minutes,
      isToday: m === thisMonth,
      isFuture: false,
      tip: `${year}年${monthNum}月 ${formatMinutesHM(minutes)}`,
    };
  });

  const days = months.flatMap((m) => acc.get(m) ?? []).filter((d) => d.date <= todayKey);
  return { bars, days };
}

export function buildTrendSeries(
  daily: StudyDayTotal[],
  range: RangeKey,
  weekOffset: number,
  today: Date = new Date()
): TrendSeries {
  const map = indexOf(daily);
  const todayKey = toLocalDateKey(today);
  const oldestKey = daily[0]?.date ?? todayKey;
  const pick = (keys: string[]) => keys.map((k) => map.get(k) ?? EMPTY_DAY(k));

  if (range === '1w') {
    const start = weekStartOf(today);
    start.setDate(start.getDate() + weekOffset * 7);
    const days = pick(dateKeysBetween(start, 7));

    const prevStart = new Date(start);
    prevStart.setDate(start.getDate() - 7);
    const prev = pick(dateKeysBetween(prevStart, 7));

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

    // 1つ前の週が取得範囲より前なら遡らせない（空のグラフを見せない）
    const backStart = weekStartOf(today);
    backStart.setDate(backStart.getDate() + (weekOffset - 1) * 7);

    return {
      bars: days.map((d, i) => ({
        key: d.date,
        x: WEEKDAY_LABELS[i],
        label: d.minutes > 0 ? formatMinutesHM(d.minutes) : null,
        minutes: d.minutes,
        isToday: d.date === todayKey,
        isFuture: d.date > todayKey,
        tip: `${d.date} ${formatMinutesHM(d.minutes)}`,
      })),
      days,
      prevMinutes: prev.reduce((s, d) => s + d.minutes, 0),
      note: `${fmt(start)} 〜 ${fmt(end)} の1日あたりの学習時間`,
      movingAverage: null,
      canGoBack: toLocalDateKey(backStart) >= oldestKey,
      showDelta: true,
    };
  }

  if (range === '30d') {
    const start = new Date(today);
    start.setDate(today.getDate() - 29);
    const days = pick(dateKeysBetween(start, 30));

    const prevStart = new Date(start);
    prevStart.setDate(start.getDate() - 30);
    const prev = pick(dateKeysBetween(prevStart, 30));

    const bars = days.map((d, i): TrendBar => {
      const dt = new Date(`${d.date}T00:00:00`);
      return {
        key: d.date,
        // 30本に全部ラベルを振ると潰れるので5日おきに間引く
        x: i % 5 === 0 || i === 29 ? `${dt.getMonth() + 1}/${dt.getDate()}` : '',
        label: null,
        minutes: d.minutes,
        isToday: d.date === todayKey,
        isFuture: false,
        tip: `${d.date} ${formatMinutesHM(d.minutes)}`,
      };
    });

    return {
      bars,
      days,
      prevMinutes: prev.reduce((s, d) => s + d.minutes, 0),
      note: '直近30日の1日あたりの学習時間。折れ線は7日移動平均です',
      movingAverage: bars.map((_, i) => {
        const window = bars.slice(Math.max(0, i - 6), i + 1);
        return window.reduce((s, b) => s + b.minutes, 0) / window.length;
      }),
      canGoBack: false,
      showDelta: true,
    };
  }

  if (range === 'month') {
    const { bars, days } = monthBuckets(daily, today);
    return {
      bars,
      days,
      prevMinutes: 0,
      note:
        bars.length >= MONTH_BARS
          ? `直近${MONTH_BARS}ヶ月の月ごとの学習時間`
          : '受講を始めてからの月ごとの学習時間',
      movingAverage: null,
      canGoBack: false,
      showDelta: false,
    };
  }

  // 3ヶ月 / 6ヶ月は日別だと91本・182本になって読めないので、週（月曜起点）に集約する
  const weeks = range === '6m' ? 26 : 13;
  const { bars, days } = weekBuckets(map, today, weeks, range === '6m' ? 4 : 2);
  return {
    bars,
    days,
    prevMinutes: 0,
    note: `直近${weeks}週の週ごとの学習時間`,
    movingAverage: null,
    canGoBack: false,
    showDelta: false,
  };
}
