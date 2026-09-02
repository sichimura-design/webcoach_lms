import { useMemo, useState } from 'react';
import { Clock } from 'lucide-react';
import { StudyStatsSummary } from '../../types/studyActivity';
import { formatMinutesHM } from '../../utils/studyStats';
import { RangeKey, TREND_RANGES, buildTrendSeries } from './trendSeries';

/**
 * 学習の推移（/study-log の③）。claude.ai/design『トップページ 3案』4a 由来。
 *
 * 🔴 期間タブを切り替えても再フェッチしない。
 *    StudyLogPage が days='all'（受講開始日〜今日）の dailyTotals を1回だけ取り、
 *    ここはその配列を切り出すだけ。タブごとに days を変えて叩くと、切り替えのたびに
 *    画面が「読み込んでいます」に戻り、しかも同じ日の値を別のリクエストで2回数える。
 *
 * 🔴 どの日をどのバーに束ねるかは trendSeries.ts（純関数）が持つ。
 *    ここは描画だけ。期間を足すときは trendSeries 側に足す。
 *
 * 🔴 KPI 4枚はこのカードから外して StudySummaryStrip に移した。
 *    4枚のうち「期間合計」だけがタブ連動で、残り3枚は無関係だったため。
 *    タブに「月別」が入ると「期間合計＝直近13ヶ月」というKPIになり、
 *    隣の「今週の学習時間」と粒度が合わなくなる。
 */
interface StudyRecordPanelProps {
  stats: StudyStatsSummary | null;
  loading: boolean;
}

/** 棒の描画領域（px）。下に曜日/日付ラベルの行が別途つく */
const PLOT_H = 150;
/** 実績0の過去日に残す最小の芯 */
const EMPTY_H = 3;

function scaleMaxOf(minutes: number[]): number {
  const peak = Math.max(0, ...minutes);
  if (peak <= 30) return 30;
  if (peak <= 60) return 60;
  if (peak <= 120) return 120;
  return Math.ceil(peak / 60) * 60;
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
        fontSize: 'var(--dc-fs-body)',
        fontWeight: active ? 700 : 500,
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

export function StudyRecordPanel({ stats, loading }: StudyRecordPanelProps) {
  const [range, setRange] = useState<RangeKey>('30d');
  /** 0 = 今週。1週間タブでのみ使う */
  const [weekOffset, setWeekOffset] = useState(0);

  const activeRange = TREND_RANGES.find((r) => r.key === range) ?? TREND_RANGES[1];
  const daily = useMemo(() => stats?.dailyTotals ?? [], [stats]);

  const series = useMemo(
    () => buildTrendSeries(daily, range, weekOffset),
    [daily, range, weekOffset]
  );
  const { bars, days, prevMinutes, note, movingAverage, canGoBack, showDelta } = series;

  const scaleMax = scaleMaxOf(bars.map((b) => b.minutes));
  const totalMinutes = days.reduce((s, d) => s + d.minutes, 0);
  const showValueLabels = bars.some((b) => b.label);
  const barPlotH = PLOT_H - (showValueLabels ? 16 : 0);

  // 平均線。週/月に束ねるタブはバーの平均、日単位のタブは実績のある側だけの平均
  const measured = range === '1w' || range === '30d' ? bars.filter((b) => !b.isFuture) : bars;
  const avg = measured.length ? Math.round(measured.reduce((s, b) => s + b.minutes, 0) / measured.length) : 0;
  const avgH = Math.min(barPlotH, Math.round((avg / scaleMax) * barPlotH));

  const delta = prevMinutes > 0 || totalMinutes > 0 ? totalMinutes - prevMinutes : 0;
  // 棒が細い30日タブだけ隙間を詰める。月別は本数が少ないので通常どおり
  const barGap = range === '30d' ? 3 : 10;

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
            width: 'var(--dc-sz-badge)', height: 'var(--dc-sz-badge)', flex: 'none',
            borderRadius: 9999, background: 'var(--dc-soft-100)', color: 'var(--dc-primary)',
            display: 'grid', placeItems: 'center',
          }}
        >
          <Clock size={16} strokeWidth={1.75} />
        </span>
        <h2
          style={{
            margin: 0, flex: 1,
            fontSize: 'var(--dc-fs-lead)', fontWeight: 700,
            color: 'var(--dc-text)', whiteSpace: 'nowrap',
          }}
        >
          学習の推移
        </h2>
        {/* タブが5つになったので折り返せるようにする（.studylog-range-tabs） */}
        <div className="studylog-range-tabs" role="tablist" aria-label="集計期間">
          {TREND_RANGES.map((r) => (
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

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '0 0 18px', flexWrap: 'wrap' }}>
        {range === '1w' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {navButton('前の週へ', '‹', canGoBack, () => setWeekOffset((w) => w - 1))}
            <span
              className="dc-num"
              style={{ fontSize: 'var(--dc-fs-body)', fontWeight: 600, color: 'var(--dc-text-body)', whiteSpace: 'nowrap' }}
            >
              {weekOffset === 0 ? '今週' : `${-weekOffset}週間前`}
            </span>
            {navButton('次の週へ', '›', weekOffset < 0, () => setWeekOffset((w) => Math.min(0, w + 1)))}
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)', whiteSpace: 'nowrap' }}>
            {activeRange.totalLabel}
          </span>
          <span
            className="dc-num"
            style={{ fontSize: 'var(--dc-fs-title)', fontWeight: 700, color: 'var(--dc-text)', whiteSpace: 'nowrap' }}
          >
            {loading ? '…' : formatMinutesHM(totalMinutes)}
          </span>
        </div>

        {showDelta && !loading && (
          <span
            className="dc-num"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              borderRadius: 9999, padding: '3px 9px',
              fontSize: 'var(--dc-fs-caption)', fontWeight: 700, whiteSpace: 'nowrap',
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
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            height: PLOT_H, fontSize: 'var(--dc-fs-caption)',
            color: 'var(--dc-text-subtle)', textAlign: 'right', flex: 'none',
          }}
        >
          <span>{formatMinutesHM(scaleMax)}</span>
          <span>{formatMinutesHM(scaleMax / 2)}</span>
          <span>0分</span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              position: 'relative', height: PLOT_H,
              borderBottom: '1px solid var(--dc-border)',
              display: 'flex', alignItems: 'flex-end',
              gap: barGap, padding: '0 4px',
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
                    position: 'absolute', right: 0, top: 2,
                    fontSize: 'var(--dc-fs-caption)', fontWeight: 600, color: '#C96E7E',
                    background: 'rgba(255,255,255,.85)', padding: '0 4px', borderRadius: 4,
                    pointerEvents: 'none', whiteSpace: 'nowrap',
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
                      position: 'absolute', left: 0, right: 0, bottom: avgH,
                      borderTop: '1.5px dashed #E5A0AC', pointerEvents: 'none',
                    }}
                  />
                  <span
                    className="dc-num"
                    style={{
                      position: 'absolute', right: 0, bottom: avgH + 2,
                      fontSize: 'var(--dc-fs-caption)', fontWeight: 600, color: '#C96E7E',
                      background: 'rgba(255,255,255,.85)', padding: '0 4px', borderRadius: 4,
                      pointerEvents: 'none', whiteSpace: 'nowrap',
                    }}
                  >
                    {range === 'month' ? '月平均' : '平均'} {formatMinutesHM(avg)}
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
                    flex: 1, minWidth: 0, height: '100%',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'flex-end',
                  }}
                >
                  {b.label && (
                    <span
                      className="dc-num"
                      style={{
                        fontSize: 'var(--dc-fs-caption)', marginBottom: 4, whiteSpace: 'nowrap',
                        fontWeight: b.isToday ? 700 : 400,
                        color: b.isToday ? 'var(--dc-primary)' : 'var(--dc-text-subtle)',
                      }}
                    >
                      {b.label}
                    </span>
                  )}
                  <span
                    style={{
                      width: '100%', maxWidth: 26, height: h,
                      borderRadius: '4px 4px 0 0',
                      background: b.isToday ? 'var(--dc-primary)' : '#EAE4DA',
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: barGap, padding: '6px 4px 0' }} aria-hidden="true">
            {bars.map((b) => (
              <span
                key={b.key}
                className="dc-num"
                style={{
                  flex: 1, minWidth: 0, textAlign: 'center',
                  fontSize: 'var(--dc-fs-caption)',
                  fontWeight: b.isToday ? 700 : 400,
                  color: b.isToday ? 'var(--dc-primary)' : 'var(--dc-text-muted)',
                  whiteSpace: 'nowrap', overflow: 'hidden',
                }}
              >
                {b.x}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-subtle)' }}>{note}</div>
    </section>
  );
}

export default StudyRecordPanel;
