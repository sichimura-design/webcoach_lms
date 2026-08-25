import { useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { StudyDayTotal, StudyStatsSummary } from '../../types/studyActivity';
import { formatMinutesHM, toLocalDateKey, weekStartOf } from '../../utils/studyStats';

/**
 * 学習記録（/study-log の①）。claude.ai/design『トップページ 3案』4a 準拠。
 *
 * 🔴 期間タブを切り替えても再フェッチしない。
 *    StudyLogPage が 92日ぶんの dailyTotals を1回だけ取り、ここはその配列を切り出すだけ。
 *    タブごとに days を変えて叩くと、切り替えのたびに画面が「読み込んでいます」に戻り、
 *    しかも同じ日の値を別のリクエストで2回数えることになる。
 *
 * 🔴 判定（学習した日 = 10分以上）は StudyDayTotal.isStudyDay をそのまま使う。
 *    閾値をここで再実装しない（utils/studyStats.ts が唯一の実装）。
 */
interface StudyRecordPanelProps {
  stats: StudyStatsSummary | null;
  loading: boolean;
}

type RangeKey = '1w' | '30d' | '3m';

const RANGES: { key: RangeKey; label: string; totalLabel: string }[] = [
  { key: '1w', label: '1週間', totalLabel: 'この週の学習時間' },
  { key: '30d', label: '30日間', totalLabel: '直近30日の学習時間' },
  { key: '3m', label: '3ヶ月', totalLabel: '直近3ヶ月の学習時間' },
];

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

/** 棒の描画領域（px）。下に曜日/日付ラベルの行が別途つく */
const PLOT_H = 150;
/** 実績0の過去日に残す最小の芯 */
const EMPTY_H = 3;

interface Bar {
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

function scaleMaxOf(minutes: number[]): number {
  const peak = Math.max(0, ...minutes);
  if (peak <= 30) return 30;
  if (peak <= 60) return 60;
  if (peak <= 120) return 120;
  return Math.ceil(peak / 60) * 60;
}

/** dailyTotals（昇順・欠損日は0埋め）から日付キーで引ける Map を作る */
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

function Pill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{
        padding: '5px 12px',
        borderRadius: 9999,
        fontFamily: 'inherit',
        fontSize: 'var(--dc-fs-xs)',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        border: `1px solid ${active ? 'var(--dc-primary)' : '#E5DED3'}`,
        background: active ? 'var(--dc-primary)' : '#fff',
        color: active ? '#fff' : 'var(--dc-text-body)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        border: '1px solid var(--dc-border)',
        borderRadius: 'var(--dc-radius-md)',
        padding: '16px 18px',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 'var(--dc-fs-2xs)', color: 'var(--dc-text-body)', marginBottom: 6, whiteSpace: 'nowrap' }}>
        {label}
      </div>
      <div
        className="dc-num"
        style={{
          fontSize: 'var(--dc-fs-lg)',
          fontWeight: 800,
          whiteSpace: 'nowrap',
          color: accent ? 'var(--dc-primary)' : 'var(--dc-text)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function StudyRecordPanel({ stats, loading }: StudyRecordPanelProps) {
  const [range, setRange] = useState<RangeKey>('30d');
  /** 0 = 今週。1週間タブでのみ使う（過去へは -12 週まで＝92日ぶんの範囲） */
  const [weekOffset, setWeekOffset] = useState(0);

  const activeRange = RANGES.find((r) => r.key === range) ?? RANGES[1];
  const daily = useMemo(() => stats?.dailyTotals ?? [], [stats]);
  /** 取得済みの最も古い日。ここより前へは遡らせない */
  const oldestKey = daily[0]?.date ?? toLocalDateKey(new Date());

  const { bars, sliceDays, prevMinutes, note } = useMemo(() => {
    const map = indexOf(daily);
    const today = new Date();
    const todayKey = toLocalDateKey(today);

    /** 日付キー配列 → その期間の StudyDayTotal 相当 */
    const pick = (keys: string[]) =>
      keys.map((k) => map.get(k) ?? { date: k, minutes: 0, sessionCount: 0, longestMinutes: 0, isStudyDay: false });

    if (range === '1w') {
      const start = weekStartOf(today);
      start.setDate(start.getDate() + weekOffset * 7);
      const keys = dateKeysBetween(start, 7);
      const days = pick(keys);

      const prevStart = new Date(start);
      prevStart.setDate(start.getDate() - 7);
      const prev = pick(dateKeysBetween(prevStart, 7));

      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

      return {
        bars: days.map((d, i): Bar => ({
          key: d.date,
          x: WEEKDAY_LABELS[i],
          label: d.minutes > 0 ? formatMinutesHM(d.minutes) : null,
          minutes: d.minutes,
          isToday: d.date === todayKey,
          isFuture: d.date > todayKey,
          tip: `${d.date} ${formatMinutesHM(d.minutes)}`,
        })),
        sliceDays: days,
        prevMinutes: prev.reduce((s, d) => s + d.minutes, 0),
        note: `${fmt(start)} 〜 ${fmt(end)} の1日あたりの学習時間`,
      };
    }

    if (range === '30d') {
      const start = new Date(today);
      start.setDate(today.getDate() - 29);
      const days = pick(dateKeysBetween(start, 30));

      const prevStart = new Date(start);
      prevStart.setDate(start.getDate() - 30);
      const prev = pick(dateKeysBetween(prevStart, 30));

      return {
        bars: days.map((d, i): Bar => {
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
        }),
        sliceDays: days,
        prevMinutes: prev.reduce((s, d) => s + d.minutes, 0),
        note: '直近30日の1日あたりの学習時間。折れ線は7日移動平均です',
      };
    }

    // 3ヶ月は日別だと91本になって読めないので、週（月曜起点）に集約する
    const thisWeekStart = weekStartOf(today);
    const weeks = Array.from({ length: 13 }, (_, i) => {
      const s = new Date(thisWeekStart);
      s.setDate(thisWeekStart.getDate() - (12 - i) * 7);
      return s;
    });
    const weekDays = weeks.map((s) => pick(dateKeysBetween(s, 7)));
    const allDays = weekDays.flat().filter((d) => d.date <= todayKey);

    return {
      bars: weeks.map((s, i): Bar => {
        const minutes = weekDays[i].reduce((sum, d) => sum + d.minutes, 0);
        const e = new Date(s);
        e.setDate(s.getDate() + 6);
        return {
          key: toLocalDateKey(s),
          x: i % 2 === 0 ? `${s.getMonth() + 1}/${s.getDate()}` : '',
          label: null,
          minutes,
          isToday: i === 12,
          isFuture: false,
          tip: `${s.getMonth() + 1}/${s.getDate()}〜${e.getMonth() + 1}/${e.getDate()} ${formatMinutesHM(minutes)}`,
        };
      }),
      sliceDays: allDays,
      prevMinutes: 0,
      note: '直近13週の週ごとの学習時間',
    };
  }, [daily, range, weekOffset]);

  const scaleMax = scaleMaxOf(bars.map((b) => b.minutes));
  const totalMinutes = sliceDays.reduce((s, d) => s + d.minutes, 0);
  const studiedDays = sliceDays.filter((d) => d.isStudyDay).length;
  const showValueLabels = bars.some((b) => b.label);
  const barPlotH = PLOT_H - (showValueLabels ? 16 : 0);

  // 平均線。3ヶ月は週平均、それ以外は日平均
  const measured = range === '3m' ? bars : bars.filter((b) => !b.isFuture);
  const avg = measured.length ? Math.round(measured.reduce((s, b) => s + b.minutes, 0) / measured.length) : 0;
  const avgH = Math.min(barPlotH, Math.round((avg / scaleMax) * barPlotH));

  // 7日移動平均（30日間タブのみ）
  const movingAverage = useMemo(() => {
    if (range !== '30d') return null;
    return bars.map((_, i) => {
      const window = bars.slice(Math.max(0, i - 6), i + 1);
      return window.reduce((s, b) => s + b.minutes, 0) / window.length;
    });
  }, [bars, range]);

  const delta = prevMinutes > 0 || totalMinutes > 0 ? totalMinutes - prevMinutes : 0;
  const showDelta = range !== '3m';

  // 取得済みは92日ぶんだけ。それより前の週へは遡らせない（空のグラフを見せない）
  const canGoBack = useMemo(() => {
    if (range !== '1w') return false;
    const prevStart = weekStartOf(new Date());
    prevStart.setDate(prevStart.getDate() + (weekOffset - 1) * 7);
    return toLocalDateKey(prevStart) >= oldestKey;
  }, [range, weekOffset, oldestKey]);

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <span
          style={{
            width: 'var(--dc-sz-badge)',
            height: 'var(--dc-sz-badge)',
            flex: 'none',
            borderRadius: 9999,
            background: 'var(--dc-soft-100)',
            color: 'var(--dc-primary)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Clock size={16} strokeWidth={1.75} />
        </span>
        <h2
          style={{
            margin: 0,
            flex: 1,
            fontSize: 'var(--dc-fs-title)',
            fontWeight: 700,
            color: 'var(--dc-text)',
            whiteSpace: 'nowrap',
          }}
        >
          学習記録
        </h2>
        <div style={{ display: 'flex', gap: 6 }} role="tablist" aria-label="集計期間">
          {RANGES.map((r) => (
            <Pill
              key={r.key}
              active={r.key === range}
              onClick={() => {
                setRange(r.key);
                setWeekOffset(0);
              }}
            >
              {r.label}
            </Pill>
          ))}
        </div>
      </div>

      <div className="studylog-kpi-grid">
        <Kpi label={activeRange.totalLabel} value={loading ? '…' : formatMinutesHM(totalMinutes)} />
        <Kpi label="学習した日数" value={loading ? '…' : `${studiedDays}日`} />
        <Kpi label="今週の学習時間" value={loading ? '…' : formatMinutesHM(stats?.week.minutes ?? 0)} />
        <Kpi label="現在の連続日数" value={loading ? '…' : `${stats?.streak.currentDays ?? 0}日`} accent />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '26px 0 18px', flexWrap: 'wrap' }}>
        {range === '1w' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              aria-label="前の週へ"
              disabled={!canGoBack}
              onClick={() => setWeekOffset((w) => w - 1)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                width: 24,
                height: 24,
                borderRadius: 9999,
                border: '1px solid var(--dc-border-strong)',
                background: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: 'var(--dc-fs-14)',
                color: canGoBack ? 'var(--dc-text-body)' : '#C9BFB0',
                cursor: canGoBack ? 'pointer' : 'not-allowed',
              }}
            >
              ‹
            </button>
            <span className="dc-num" style={{ fontSize: 'var(--dc-fs-xs)', fontWeight: 700, color: 'var(--dc-text-body)', whiteSpace: 'nowrap' }}>
              {weekOffset === 0 ? '今週' : `${-weekOffset}週間前`}
            </span>
            <button
              type="button"
              aria-label="次の週へ"
              disabled={weekOffset >= 0}
              onClick={() => setWeekOffset((w) => Math.min(0, w + 1))}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                width: 24,
                height: 24,
                borderRadius: 9999,
                border: '1px solid var(--dc-border-strong)',
                background: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: 'var(--dc-fs-14)',
                color: weekOffset < 0 ? 'var(--dc-text-body)' : '#C9BFB0',
                cursor: weekOffset < 0 ? 'pointer' : 'not-allowed',
              }}
            >
              ›
            </button>
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 'var(--dc-fs-2xs)', color: 'var(--dc-text-muted)', whiteSpace: 'nowrap' }}>期間合計</span>
          <span className="dc-num" style={{ fontSize: 'var(--dc-fs-15)', fontWeight: 800, color: 'var(--dc-text)', whiteSpace: 'nowrap' }}>
            {loading ? '…' : formatMinutesHM(totalMinutes)}
          </span>
        </div>

        {showDelta && !loading && (
          <span
            className="dc-num"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              borderRadius: 9999,
              padding: '3px 9px',
              fontSize: 'var(--dc-fs-2xs)',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              background: delta >= 0 ? 'var(--dc-success-surface)' : 'var(--dc-sunken)',
              color: delta >= 0 ? 'var(--dc-success)' : 'var(--dc-text-muted)',
            }}
          >
            {delta >= 0 ? '↑' : '↓'} {formatMinutesHM(Math.abs(delta))}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div
          className="dc-num"
          aria-hidden="true"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: PLOT_H,
            fontSize: 'var(--dc-fs-3xs)',
            color: 'var(--dc-text-subtle)',
            textAlign: 'right',
            flex: 'none',
          }}
        >
          <span>{formatMinutesHM(scaleMax)}</span>
          <span>{formatMinutesHM(scaleMax / 2)}</span>
          <span>0分</span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              position: 'relative',
              height: PLOT_H,
              borderBottom: '1px solid var(--dc-border)',
              display: 'flex',
              alignItems: 'flex-end',
              gap: range === '30d' ? 3 : 10,
              padding: '0 4px',
            }}
          >
            {/* 平均線。30日間タブは移動平均の折れ線に差し替える */}
            {movingAverage ? (
              <>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                >
                  <polyline
                    fill="none"
                    stroke="#E5A0AC"
                    strokeWidth="1.5"
                    vectorEffect="non-scaling-stroke"
                    points={movingAverage
                      .map((v, i) => {
                        const x = ((i + 0.5) / movingAverage.length) * 100;
                        const y = 100 - Math.min(100, (v / scaleMax) * 100);
                        return `${x.toFixed(2)},${y.toFixed(2)}`;
                      })
                      .join(' ')}
                  />
                </svg>
                <span
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 2,
                    fontSize: 'var(--dc-fs-4xs)',
                    fontWeight: 600,
                    color: '#C96E7E',
                    background: 'rgba(255,255,255,.85)',
                    padding: '0 4px',
                    borderRadius: 4,
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  7日移動平均
                </span>
              </>
            ) : (
              avg > 0 && (
                <>
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: avgH,
                      borderTop: '1.5px dashed #E5A0AC',
                      pointerEvents: 'none',
                    }}
                  />
                  <span
                    className="dc-num"
                    style={{
                      position: 'absolute',
                      right: 0,
                      bottom: avgH + 2,
                      fontSize: 'var(--dc-fs-4xs)',
                      fontWeight: 600,
                      color: '#C96E7E',
                      background: 'rgba(255,255,255,.85)',
                      padding: '0 4px',
                      borderRadius: 4,
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    平均 {formatMinutesHM(avg)}
                  </span>
                </>
              )
            )}

            {bars.map((b) => {
              const h = b.isFuture
                ? 0
                : Math.max(b.minutes > 0 ? EMPTY_H : 2, Math.round((b.minutes / scaleMax) * barPlotH));
              return (
                <div
                  key={b.key}
                  title={b.tip}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                  }}
                >
                  {b.label && (
                    <span
                      className="dc-num"
                      style={{
                        fontSize: 'var(--dc-fs-3xs)',
                        marginBottom: 4,
                        whiteSpace: 'nowrap',
                        fontWeight: b.isToday ? 700 : 400,
                        color: b.isToday ? 'var(--dc-primary)' : 'var(--dc-text-subtle)',
                      }}
                    >
                      {b.label}
                    </span>
                  )}
                  <span
                    style={{
                      width: '100%',
                      maxWidth: 26,
                      height: h,
                      borderRadius: '4px 4px 0 0',
                      background: b.isToday ? 'var(--dc-primary)' : '#EAE4DA',
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: range === '30d' ? 3 : 10, padding: '6px 4px 0' }} aria-hidden="true">
            {bars.map((b) => (
              <span
                key={b.key}
                className="dc-num"
                style={{
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'center',
                  fontSize: 'var(--dc-fs-3xs)',
                  fontWeight: b.isToday ? 700 : 400,
                  color: b.isToday ? 'var(--dc-primary)' : 'var(--dc-text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                {b.x}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 'var(--dc-fs-2xs)', color: 'var(--dc-text-subtle)' }}>{note}</div>
    </section>
  );
}

export default StudyRecordPanel;
