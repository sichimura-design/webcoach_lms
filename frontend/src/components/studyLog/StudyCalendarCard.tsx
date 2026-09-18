import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Headphones } from 'lucide-react';
import { addDays, format } from 'date-fns';
import { StudyDayTotal } from '../../types/studyActivity';
import {
  STUDY_DAY_MIN_MINUTES,
  STUDY_HEAT_THRESHOLDS,
  formatMinutesHM,
  heatLevelOf,
  toLocalDateKey,
} from '../../utils/studyStats';

/**
 * 学習カレンダー（/study-log の主役）。
 * ============================================================
 * 旧 StreakCalendarCard の置き換え。あちらは「学習した日かどうか」の二値を炎マークで
 * 出すだけで、3か月前までしか遡れなかった。ここでは
 *   ・学習時間の多寡を濃淡で出す（どれだけやったか）
 *   ・コーチングを受けた日は金のリングで囲い、ヘッドホンを重ねる（何をやったか）
 *   ・日をクリックすると右（狭い画面では下）にその日の詳細が開く
 *   ・受講開始月まで遡れる
 * を足している。
 *
 * 🔴 濃淡の閾値は utils/studyStats.ts の STUDY_HEAT_THRESHOLDS が唯一の実装。
 *    ここで再定義しないこと。段は 30/60/120 分の3つで、これはストリークの
 *    「学習した日」（STUDY_DAY_MIN_MINUTES = 10分）とは別の軸。
 *    10〜29分の日は段に入らないが学習した日ではあるので、濃淡ではなく
 *    aria-label の文言のほうでストリークと同じ判定を持つ（minutes >= 10）。
 *    塗りの上では 1〜29分をまとめて「記録あり」（淡い地）として出す。
 *
 * 🔴 色だけで情報を伝えない（design-token-spec.md）。
 *    濃淡に加えて、凡例の分数表記と aria-label の文言が同じことを伝えている。
 *    かつては升目の中にも段階ドット（赤い四角1〜3個）を重ねていたが、
 *    凡例に説明が無く「この点は何か」が読めないという指摘で撤去した。
 *    升目の中に増やすのではなく、凡例と読み上げのほうを正確に保つこと。
 *
 * 🔴 赤は「学習時間の多寡」専用にする。状態（今日・選択中）は赤の外へ出す。
 *    選択中を赤枠にしていた頃は、濃淡の赤と同系色で「濃い日」なのか
 *    「選んだ日」なのか読み分けられなかった。今は
 *      選択中 = 濃いニュートラルの枠（＋内側の細い白枠）
 *      今日   = 日付の数字の代わりに「今日」と書く
 *    で、伝える手段（枠と文字）そのものを分けてある。
 *    かつては今日をセル下端の 12×2px の横バーで示していたが、
 *    小さすぎて気づかれず、凡例の「— 今日」も何の記号か読めなかった。
 *    文字で書けば凡例が要らない。トップの7日ストリップ（StudyDashboardCard）が
 *    既に同じ手（isToday なら「今日」と出す）を使っていて、表現も揃う。
 *    🔴 今日の表現を色に戻さないこと。上の原則どおり赤は多寡専用で、
 *       濃い段（L3）の日が今日になっても文字だけで読み分けられる必要がある。
 *    形のほかに aria-pressed / aria-current="date" / label の文言でも伝える。
 *    セルに「45分」と文字で入れないのは、--dc-sz-cell の下限が 38px で
 *    12px×4文字が溢れるため（12px未満は作らない規約がある）。「今日」は2文字なので入る。
 *
 * 🔴 42個のセルを全部タブ順に入れない（roving tabindex）。
 *    タブキーで1つの月に42回止まると、その下のカードへ辿り着けない。
 *    フォーカスは常に1つだけが受け取り、中の移動は矢印キーで行う。
 * ============================================================
 */

interface StudyCalendarCardProps {
  /** 表示中の月 'YYYY-MM' */
  monthKey: string;
  /** 日付キー → その日の合計。stats.dailyTotals から作る */
  dayTotals: Record<string, StudyDayTotal>;
  /** コーチングを受けた日 */
  coachingDates: Set<string>;
  selectedDate: string | null;
  /** 遡れる下限の月（= 最初の記録の月）。null なら遡り不可 */
  minMonthKey: string | null;
  loading: boolean;
  onMonthChange: (monthKey: string) => void;
  onSelectDate: (date: string | null) => void;
  /** 「今日」ボタン。表示月を今月に戻して今日を選ぶ（呼び出し側で両方やる） */
  onSelectToday: () => void;
}

const WEEKDAYS = [
  { short: '月', full: '月曜日' },
  { short: '火', full: '火曜日' },
  { short: '水', full: '水曜日' },
  { short: '木', full: '木曜日' },
  { short: '金', full: '金曜日' },
  { short: '土', full: '土曜日' },
  { short: '日', full: '日曜日' },
];

/**
 * 濃淡の見た目。段階は heatLevelOf が決める（ここでは閾値を判定しない）。
 * 🔴 --dc-soft-100（#FDF2F2）は段に使わない。白いカードの上で記録なしのセルと
 *    ほとんど差が出ず、4段あった頃に「濃淡が読めない」原因になっていた。
 */
const HEAT_STYLE: { background: string; color: string; border: string }[] = [
  // 0: 記録なし（30分未満 1〜29分もここを使い、地と記号だけ変える）
  { background: 'var(--dc-surface)', color: 'var(--dc-text-muted)', border: 'var(--dc-border)' },
  { background: 'var(--dc-soft-200)', color: 'var(--dc-text)', border: 'var(--dc-soft-200)' },
  // L2/L3 は地が濃いので、文字色のコントラストが変わる
  { background: 'var(--dc-bar-past)', color: 'var(--dc-text)', border: 'var(--dc-bar-past)' },
  { background: 'var(--dc-primary)', color: '#fff', border: 'var(--dc-primary)' },
];

/** 月曜始まりの曜日インデックス（0=月 … 6=日） */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function parseMonthKey(monthKey: string): { year: number; month: number } {
  return { year: Number(monthKey.slice(0, 4)), month: Number(monthKey.slice(5, 7)) - 1 };
}

function shiftMonth(monthKey: string, delta: number): string {
  const { year, month } = parseMonthKey(monthKey);
  return format(new Date(year, month + delta, 1), 'yyyy-MM');
}

interface Cell {
  key: string;
  blank: boolean;
  day: number;
  minutes: number;
  level: 0 | 1 | 2 | 3;
  /** 1〜29分。最初の段（30分）には満たないが記録はある */
  recorded: boolean;
  coaching: boolean;
  isToday: boolean;
  isFuture: boolean;
  label: string;
}

export function StudyCalendarCard({
  monthKey,
  dayTotals,
  coachingDates,
  selectedDate,
  minMonthKey,
  loading,
  onMonthChange,
  onSelectDate,
  onSelectToday,
}: StudyCalendarCardProps) {
  const todayKey = toLocalDateKey(new Date());

  const { cells, title, firstDayKey } = useMemo(() => {
    const { year, month } = parseMonthKey(monthKey);
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const lead = mondayIndex(first);

    // 6週42セル固定。月をまたいでも高さが変わらず、切り替えで下のカードが跳ねない
    const list: Cell[] = Array.from({ length: 42 }, (_, i) => {
      const day = i - lead + 1;
      if (day < 1 || day > daysInMonth) {
        return {
          key: `blank-${i}`, blank: true, day: 0, minutes: 0, level: 0 as const,
          recorded: false, coaching: false, isToday: false, isFuture: false, label: '',
        };
      }
      const d = new Date(year, month, day);
      const key = format(d, 'yyyy-MM-dd');
      const total = dayTotals[key];
      const minutes = total?.minutes ?? 0;
      const level = heatLevelOf(minutes);
      const coaching = coachingDates.has(key);
      const isFuture = key > todayKey;

      // 読み上げは「日付 → 学習時間 → 学習日かどうか → コーチング」の順。
      // 色や記号が読めない人にも、セルが持つ情報が全部届くようにする
      const parts = [`${d.getMonth() + 1}月${day}日`, WEEKDAYS[mondayIndex(d)].full];
      if (isFuture) parts.push('これから');
      else if (minutes === 0) parts.push('記録なし');
      else {
        parts.push(formatMinutesHM(minutes));
        // 🔴 濃淡の段（level）ではなくストリークと同じ閾値で判定する。
        //    level は 30分からしか立たないので、level > 0 で見ると
        //    15分の日が「10分未満」と読み上げられてストリークと食い違う。
        parts.push(minutes >= STUDY_DAY_MIN_MINUTES ? '学習した日' : `${STUDY_DAY_MIN_MINUTES}分未満`);
        if ((total?.sessionCount ?? 0) > 0) parts.push(`記録${total?.sessionCount}件`);
      }
      if (coaching) parts.push('コーチングあり');

      return {
        key, blank: false, day, minutes, level,
        recorded: minutes > 0 && level === 0,
        coaching, isToday: key === todayKey, isFuture,
        label: parts.join(' '),
      };
    });

    return {
      cells: list,
      title: `${year}年${month + 1}月`,
      firstDayKey: format(first, 'yyyy-MM-dd'),
    };
  }, [monthKey, dayTotals, coachingDates, todayKey]);

  const canGoBack = minMonthKey !== null && monthKey > minMonthKey;
  const canGoForward = monthKey < todayKey.slice(0, 7);

  // --- roving tabindex ------------------------------------------------------
  // タブで入ったときに受け取るセルを1つだけ決める。選択中 → 今日 → 月初 の順。
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  // キーボードで動かしたときだけフォーカスを移す（クリックでスクロールが飛ばないように）
  const pendingFocus = useRef<string | null>(null);

  const activeKey = useMemo(() => {
    const inMonth = (k: string | null) => k !== null && k.startsWith(monthKey);
    if (inMonth(focusKey)) return focusKey as string;
    if (inMonth(selectedDate)) return selectedDate as string;
    if (inMonth(todayKey)) return todayKey;
    return firstDayKey;
  }, [focusKey, selectedDate, todayKey, monthKey, firstDayKey]);

  useEffect(() => {
    if (!pendingFocus.current) return;
    const el = cellRefs.current.get(pendingFocus.current);
    pendingFocus.current = null;
    el?.focus();
  }, [activeKey, monthKey]);

  /** 矢印キーの移動先へ。月をまたぐときは表示月ごと動かす */
  const moveTo = useCallback(
    (nextKey: string) => {
      if (nextKey > todayKey) return;                       // これからの日には入らない
      const nextMonth = nextKey.slice(0, 7);
      if (minMonthKey !== null && nextMonth < minMonthKey) return;
      pendingFocus.current = nextKey;
      setFocusKey(nextKey);
      if (nextMonth !== monthKey) onMonthChange(nextMonth);
    },
    [todayKey, minMonthKey, monthKey, onMonthChange]
  );

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const cur = new Date(
      Number(activeKey.slice(0, 4)),
      Number(activeKey.slice(5, 7)) - 1,
      Number(activeKey.slice(8, 10))
    );
    const go = (days: number) => {
      e.preventDefault();
      moveTo(format(addDays(cur, days), 'yyyy-MM-dd'));
    };

    switch (e.key) {
      case 'ArrowLeft': return go(-1);
      case 'ArrowRight': return go(1);
      case 'ArrowUp': return go(-7);
      case 'ArrowDown': return go(7);
      case 'Home': return go(-mondayIndex(cur));
      case 'End': return go(6 - mondayIndex(cur));
      case 'PageUp': {
        e.preventDefault();
        const prev = shiftMonth(monthKey, -1);
        if (minMonthKey !== null && prev >= minMonthKey) {
          pendingFocus.current = `${prev}-01`;
          setFocusKey(`${prev}-01`);
          onMonthChange(prev);
        }
        return;
      }
      case 'PageDown': {
        e.preventDefault();
        const next = shiftMonth(monthKey, 1);
        if (next <= todayKey.slice(0, 7)) {
          pendingFocus.current = `${next}-01`;
          setFocusKey(`${next}-01`);
          onMonthChange(next);
        }
        return;
      }
      default:
    }
  };

  const navButton = (label: string, glyph: string, enabled: boolean, onClick: () => void) => (
    <button
      type="button"
      aria-label={label}
      disabled={!enabled}
      onClick={onClick}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{
        width: 24, height: 24, borderRadius: 9999,
        border: '1px solid var(--dc-border-strong)', background: '#fff',
        display: 'grid', placeItems: 'center',
        fontSize: 'var(--dc-fs-body)',
        color: enabled ? 'var(--dc-text-body)' : '#C9BFB0',
        cursor: enabled ? 'pointer' : 'not-allowed',
      }}
    >
      {glyph}
    </button>
  );

  /*
   * 🔴 段階を示す赤いドット（1〜3個）と、1〜29分の日の中空の丸は撤去した。
   *    濃淡と同じことを升目の中でもう一度言っていただけで、凡例に説明も無く、
   *    「この点は何か」が読めなかった（実際にそう指摘された）。
   *    段の情報は 濃淡・凡例の分数表記・aria-label の3つが持つ。戻さないこと。
   */

  return (
    <section
      style={{
        background: 'var(--dc-surface)',
        border: '1px solid var(--dc-border)',
        borderRadius: 'var(--dc-radius-lg)',
        boxShadow: 'var(--dc-shadow-card)',
        padding: 'var(--dc-sp-card-y) var(--dc-sp-card-x)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
        <span
          style={{
            width: 'var(--dc-sz-badge)', height: 'var(--dc-sz-badge)', flex: 'none',
            borderRadius: 9999, background: 'var(--dc-soft-100)', color: 'var(--dc-primary)',
            display: 'grid', placeItems: 'center',
          }}
        >
          <CalendarDays size={16} strokeWidth={1.75} />
        </span>
        <h2 style={{ margin: 0, flex: 1, fontSize: 'var(--dc-fs-lead)', fontWeight: 700, color: 'var(--dc-text)', whiteSpace: 'nowrap' }}>
          学習カレンダー
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {navButton('前の月へ', '‹', canGoBack, () => onMonthChange(shiftMonth(monthKey, -1)))}
          <span className="dc-num" style={{ fontSize: 'var(--dc-fs-body)', fontWeight: 600, color: 'var(--dc-text-body)', whiteSpace: 'nowrap', minWidth: 92, textAlign: 'center' }}>
            {title}
          </span>
          {navButton('次の月へ', '›', canGoForward, () => onMonthChange(shiftMonth(monthKey, 1)))}
          {/* 遡ったあとに戻る手段。月を今月へ戻して今日を選ぶところまでやる */}
          <button
            type="button"
            onClick={onSelectToday}
            className="dc-cta-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              minHeight: 24,
              padding: '0 10px',
              borderRadius: 9999,
              border: '1px solid var(--dc-border-strong)',
              background: '#fff',
              fontFamily: 'inherit',
              fontSize: 'var(--dc-fs-caption)',
              fontWeight: 700,
              color: 'var(--dc-text-body)',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            今日
          </button>
        </div>
      </div>

      {/* 下限に達したことを、押せないボタンの見た目だけでなく文言でも伝える */}
      <p style={{ margin: '0 0 14px', minHeight: 18, fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-subtle)' }}>
        {!canGoBack && minMonthKey !== null && monthKey === minMonthKey
          ? 'これより前の記録はありません'
          : '日付を選ぶと、その日の学習内容が見られます'}
      </p>

      <div role="grid" aria-label={`${title} の学習カレンダー`} aria-busy={loading} onKeyDown={onGridKeyDown}>
        <div role="row" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, marginBottom: 8 }}>
          {WEEKDAYS.map((w) => (
            <span
              key={w.short}
              role="columnheader"
              style={{ textAlign: 'center', fontSize: 'var(--dc-fs-caption)', fontWeight: 600, color: 'var(--dc-text-subtle)' }}
            >
              {/* 読み上げには「月曜日」、目には「月」 */}
              <abbr title={w.full} style={{ textDecoration: 'none' }}>{w.short}</abbr>
            </span>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
          {cells.map((c) => {
            if (c.blank) return <span key={c.key} role="gridcell" style={{ height: 'var(--dc-sz-cell)' }} />;

            const selected = c.key === selectedDate;
            const heat = HEAT_STYLE[c.level];

            return (
              <span key={c.key} role="gridcell" style={{ display: 'block', minWidth: 0 }}>
                <button
                  type="button"
                  ref={(el) => {
                    if (el) cellRefs.current.set(c.key, el);
                    else cellRefs.current.delete(c.key);
                  }}
                  className="studylog-cal-cell focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  // 42個のうち1つだけがタブ順に入る。中の移動は矢印キー
                  tabIndex={c.key === activeKey ? 0 : -1}
                  disabled={c.isFuture}
                  aria-disabled={c.isFuture || undefined}
                  aria-pressed={selected}
                  aria-current={c.isToday ? 'date' : undefined}
                  aria-label={c.label}
                  onFocus={() => setFocusKey(c.key)}
                  onClick={() => onSelectDate(selected ? null : c.key)}
                  style={{
                    width: '100%',
                    // 🔴 列幅（広い画面では120px超）いっぱいに広げない。升目が横長の帯になって
                    //    カレンダーに見えなくなる。上限を置いて列の中央に寄せる。
                    //    狭い画面では列幅のほうが小さいので 100% 側が効く。
                    maxWidth: 88,
                    margin: '0 auto',
                    height: 'var(--dc-sz-cell)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                    borderRadius: 10, boxSizing: 'border-box', padding: 0,
                    position: 'relative',
                    fontFamily: 'inherit',
                    cursor: c.isFuture ? 'default' : 'pointer',
                    background: c.isFuture ? 'transparent' : c.recorded ? 'var(--dc-sunken)' : heat.background,
                    // 🔴 選択中は赤にしない。濃淡の赤と同系色だと「濃い日」と読み分けられない
                    border: selected
                      ? '2px solid var(--dc-text)'
                      : c.isFuture
                        ? '1px dashed var(--dc-idle-dash)'
                        : `1px solid ${c.recorded ? 'var(--dc-border)' : heat.border}`,
                    /*
                     * 内側に地の色の細い枠を挟んで、濃い段（L2/L3）でも枠が沈まないようにする。
                     * 🔴 コーチングを受けた日は外側に金のリングを重ねる。border では出さないこと。
                     *    border は「選択中」が 2px の黒で使っていて、コーチングの日を選んだ
                     *    瞬間に金が消える（＝選ぶと手がかりが1つ減る）。外側のリングなら
                     *    選択中の黒枠と同時に出せる。
                     */
                    boxShadow: [
                      selected ? 'inset 0 0 0 2px var(--dc-surface)' : null,
                      c.coaching ? '0 0 0 2px var(--dc-gold)' : null,
                    ]
                      .filter(Boolean)
                      .join(', ') || undefined,
                  }}
                >
                  <span
                    className="dc-num"
                    style={{
                      fontSize: 'var(--dc-fs-caption)',
                      fontWeight: c.level > 0 || c.recorded || c.isToday ? 700 : 400,
                      // 記録ありは段0と同じ HEAT_STYLE を使うが、文字は記録なし（muted）より
                      // 一段濃くする。地の差（--dc-sunken）だけだと白セルとの違いが弱い
                      color: c.isFuture
                        ? 'var(--dc-text-subtle)'
                        : c.recorded
                          ? 'var(--dc-text-body)'
                          : heat.color,
                      lineHeight: 1,
                    }}
                  >
                    {c.isToday ? '今日' : c.day}
                  </span>

                  {c.coaching && (
                    /*
                     * 段階ドット（四角）と形を変える。濃淡の一部に読まれないように。
                     * 🔴 大きさは index.css の .studylog-cal-coaching が持つ（インラインで書かない）。
                     *    狭い画面では升目が 38px しかなく、中央の日付（2桁で約13px）に
                     *    マークが重なって数字が読めなくなる。広い画面（升目 50px）でだけ
                     *    大きくしたいので、メディアクエリのあるクラス側で持つ
                     *    （インライン style にメディアクエリは書けない）。
                     *    size は指定しない。svg の寸法もクラスが決める。
                     */
                    <span aria-hidden="true" className="studylog-cal-coaching">
                      <Headphones strokeWidth={2.75} />
                    </span>
                  )}

                  {/* 今日はセルの中の文字そのものが「今日」になっている（上の🔴参照）。
                      記号は足さない。足すと段階ドットやコーチングのマークと競合する */}
                </button>
              </span>
            );
          })}
        </div>
      </div>

      {/* 凡例。濃淡の段階と分数を対応させて、色が読めなくても意味が取れるようにする */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap',
          fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span>学習時間</span>
          {/* 段には入らないが記録はある日（1〜29分）。少ない順に並べたいので scale の先頭に置く。
              見本は升目と同じ地の色で出す（中空の丸は升目から外したので凡例でも使わない） */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span
              aria-hidden="true"
              style={{ width: 16, height: 16, borderRadius: 4, background: 'var(--dc-sunken)', border: '1px solid var(--dc-border)' }}
            />
            <span>記録あり</span>
          </span>
          {([1, 2, 3] as const).map((lv) => (
            <span key={lv} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 16, height: 16, borderRadius: 4,
                  background: HEAT_STYLE[lv].background,
                  border: `1px solid ${HEAT_STYLE[lv].border}`,
                }}
              />
              <span className="dc-num">
                {lv === 3 ? `${STUDY_HEAT_THRESHOLDS[2]}分〜` : `${STUDY_HEAT_THRESHOLDS[lv - 1]}〜`}
              </span>
            </span>
          ))}
        </span>
        {/* 見本は升目と同じ形（金のリング＋ヘッドホン）で出す */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <span
            aria-hidden="true"
            style={{
              width: 14, height: 14, borderRadius: 5, boxShadow: '0 0 0 2px var(--dc-gold)',
              display: 'grid', placeItems: 'center',
            }}
          >
            <Headphones size={9} strokeWidth={2.75} color="var(--dc-gold)" />
          </span>
          <span>コーチングあり</span>
        </span>
        {/* 🔴 「今日」の凡例は置かない。今日のセルにはそのまま「今日」と書いてあるので、
               記号の説明が要らない。見本はセルの中の記号と同じ形・同じ色で出す（枠 = 選択中） */}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span aria-hidden="true" style={{ width: 14, height: 14, borderRadius: 5, border: '2px solid var(--dc-text)' }} />
          <span>選択中</span>
        </span>
      </div>
    </section>
  );
}

export default StudyCalendarCard;
