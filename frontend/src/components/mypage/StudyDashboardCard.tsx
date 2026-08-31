import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { Activity, Clock, Flame, RotateCcw } from 'lucide-react';
import { StudyStatsSummary } from '../../types/studyActivity';
import { formatMinutesHM, splitMinutesHM, toLocalDateKey, weekStartOf } from '../../utils/studyStats';

/**
 * 学習状況ダッシュボード（マイページ下段・全幅）。
 * claude.ai/design『トップページ 3案』8a 準拠。
 *
 * 5a では「学習ストリーク」「学習記録」の2枚に分かれていた数字を1枚に集約した。
 * 内訳は 左＝連続学習日数＋総学習時間／修了レッスン数、右＝今週の学習時間ゲージ＋今週の目標。
 *
 * 🔴 まだ来ていない曜日を「未学習」の灰色で塗らない（StudyRecordCard から引き継いだ方針）。
 *    金曜に見ると土日が凹んで見え、まだ起きていない不足を先に見せることになる。
 *    未来は破線の丸／極薄のスタブにして、判定していないことを形で示す。
 *
 * 🔴 このカードにCTAは置かない。「目標を変更」だけはアウトラインのピルで、
 *    マイページ唯一の Primary CTA（ResumeStudyCard）と競合させないこと。
 */
interface StudyDashboardCardProps {
  stats: StudyStatsSummary | null;
  loading: boolean;
  /** 修了レッスン数（コースの進捗率からの推定値） */
  completedLessons: number;
  /** 修了レッスン数の今週ぶんの増分。取れないときは null */
  completedLessonsDelta: number | null;
  /** 今週の学習時間の目標（分） */
  goalMinutes: number;
  /** 「目標を変更」 */
  onEditGoal: () => void;
}

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

/** ゲージの半径。8a は viewBox 118 の中に r=50 */
const RING_R = 50;
const RING_C = 2 * Math.PI * RING_R;

/** 棒の最大描画高さ（px）。8a の height:110 に合わせる */
const BAR_MAX_H = 110;
/** 実績0分の日に残す最小の芯。棒が消えると「その日が無い」ように見える */
const BAR_EMPTY_H = 5;

const CARD_STYLE: CSSProperties = {
  background: 'var(--dc-surface)',
  border: '1px solid var(--dc-border)',
  borderRadius: 'var(--dc-radius-lg)',
  boxShadow: 'var(--dc-shadow-card)',
  padding: 'var(--dc-sp-card-y) var(--dc-sp-card-x)',
};

const BLOCK_LABEL_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  fontSize: 'var(--dc-fs-xs)',
  fontWeight: 700,
  color: 'var(--dc-text-body)',
  marginBottom: 14,
};

type Day = {
  key: string;
  label: string;
  minutes: number;
  isStudyDay: boolean;
  isToday: boolean;
  isFuture: boolean;
};

/** 目盛りの上限。1日の目標ペースと実績のうち大きいほうに合わせ、30分単位で切り上げる */
function scaleMaxOf(minutes: number[], perDayTarget: number): number {
  const peak = Math.max(0, perDayTarget, ...minutes);
  return Math.max(30, Math.ceil(peak / 30) * 30);
}

/** 「1.5h」。棒の上の小さなラベル用（8a 表記） */
function formatHoursShort(min: number): string {
  if (min <= 0) return '0h';
  return `${(min / 60).toFixed(1).replace(/\.0$/, '')}h`;
}

/** KPI 1枚。StudyRecordCard の MiniStat と同じ折り返し方針（単位は数値より小さく） */
function MiniStat({
  label,
  icon,
  parts,
  footnote,
}: {
  label: string;
  icon: ReactNode;
  parts: { value: string; unit: string }[];
  footnote: string | null;
}) {
  return (
    <div
      style={{
        background: 'var(--dc-bg)',
        border: '1px solid var(--dc-border)',
        borderRadius: 14,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
      }}
    >
      <div style={BLOCK_LABEL_STYLE}>
        {icon}
        {label}
      </div>
      <div
        className="dc-num"
        style={{ fontSize: 'var(--dc-fs-kpi-sub)', fontWeight: 800, color: 'var(--dc-text)', marginBottom: 8, lineHeight: 1.25 }}
      >
        {parts.map((p, i) => (
          <span key={i} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
            <span style={{ fontSize: 'var(--dc-fs-lg)' }}>{p.value}</span>
            {p.unit}
          </span>
        ))}
      </div>
      {footnote && (
        <div style={{ fontSize: 'var(--dc-fs-3xs)', color: 'var(--dc-text-subtle)', marginTop: 'auto' }}>
          {footnote}
        </div>
      )}
    </div>
  );
}

export function StudyDashboardCard({
  stats,
  loading,
  completedLessons,
  completedLessonsDelta,
  goalMinutes,
  onEditGoal,
}: StudyDashboardCardProps) {
  const days = useMemo<Day[]>(() => {
    const byDate = new Map((stats?.dailyTotals ?? []).map((d) => [d.date, d]));
    const today = new Date();
    const todayKey = toLocalDateKey(today);
    const start = weekStartOf(today);

    return WEEKDAY_LABELS.map((label, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = toLocalDateKey(d);
      const hit = byDate.get(key);
      return {
        key,
        label,
        minutes: hit?.minutes ?? 0,
        isStudyDay: hit?.isStudyDay ?? false,
        isToday: key === todayKey,
        isFuture: key > todayKey,
      };
    });
  }, [stats]);

  const weekMinutes = stats?.week.minutes ?? 0;
  const perDayTarget = Math.round(goalMinutes / 7);
  const scaleMax = scaleMaxOf(days.map((d) => d.minutes), perDayTarget);
  const ratio = goalMinutes > 0 ? Math.min(1, weekMinutes / goalMinutes) : 0;
  const filled = RING_C * ratio;
  const remain = Math.max(0, goalMinutes - weekMinutes);
  const loadingParts = [{ value: '…', unit: '' }];

  const streakDays = stats?.streak.currentDays ?? 0;
  const bestDays = stats?.streak.bestDays ?? 0;

  return (
    <section style={CARD_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
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
          <Activity size={16} strokeWidth={2} />
        </span>
        <h2 style={{ margin: 0, fontSize: 'var(--dc-fs-title)', fontWeight: 700, color: 'var(--dc-text)' }}>
          学習状況ダッシュボード
        </h2>
      </div>

      <div className="mypage-dash-grid">
        {/* ── 左: 連続学習日数 ＋ KPI 2枚 ───────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          <div
            style={{
              background: 'var(--dc-soft-100)',
              border: '1px solid var(--dc-soft-200)',
              borderRadius: 14,
              padding: '16px 18px',
            }}
          >
            <div style={BLOCK_LABEL_STYLE}>
              <Flame size={14} fill="var(--dc-primary)" strokeWidth={0} />
              連続学習日数
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 14, flexWrap: 'wrap' }}>
              <span
                className="dc-num"
                style={{ fontSize: 'var(--dc-fs-hero-xs)', fontWeight: 800, color: 'var(--dc-primary)', lineHeight: 1 }}
              >
                {loading ? '…' : streakDays}
              </span>
              <span style={{ fontSize: 'var(--dc-fs-base)', fontWeight: 700, color: 'var(--dc-text)' }}>
                日連続で学習中
              </span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 'var(--dc-fs-2xs)', color: 'var(--dc-text-muted)', whiteSpace: 'nowrap' }}>
                🔥 自己ベスト：{loading ? '…' : bestDays}日
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {days.map((d) => {
                const on = d.isStudyDay || (d.isToday && d.minutes > 0);
                return (
                  <div
                    key={d.key}
                    title={`${d.label}曜日 ${formatMinutesHM(d.minutes)}`}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}
                  >
                    <span
                      style={{
                        fontSize: 'var(--dc-fs-4xs)',
                        fontWeight: d.isToday ? 800 : 400,
                        color: d.isToday
                          ? 'var(--dc-primary)'
                          : d.isFuture
                            ? 'var(--dc-text-subtle)'
                            : 'var(--dc-text-muted)',
                      }}
                    >
                      {d.isToday ? '今日' : d.label}
                    </span>
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 9999,
                        display: 'grid',
                        placeItems: 'center',
                        background: d.isToday && on ? 'var(--dc-primary)' : on ? '#FDECEC' : 'transparent',
                        border: d.isFuture
                          ? '2px dashed #E5DED3'
                          : on
                            ? 0
                            : '2px solid var(--dc-idle-border)',
                        boxShadow: d.isToday && on ? '0 4px 10px -4px rgba(160,8,36,.5)' : undefined,
                      }}
                    >
                      {on && (
                        <Flame
                          size={12}
                          fill={d.isToday ? '#fff' : 'var(--dc-primary)'}
                          strokeWidth={0}
                        />
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <MiniStat
              label="総学習時間"
              icon={<Clock size={14} strokeWidth={2} color="var(--dc-primary)" />}
              parts={loading ? loadingParts : splitMinutesHM(stats?.allTime.minutes ?? 0)}
              footnote={loading ? null : `今月：${formatMinutesHM(stats?.month.minutes ?? 0)}`}
            />
            <MiniStat
              label="修了レッスン数"
              icon={<RotateCcw size={14} strokeWidth={2} color="var(--dc-primary)" />}
              parts={loading ? loadingParts : [{ value: String(completedLessons), unit: 'レッスン' }]}
              // 8a は「今月：+4レッスン」だが、月ぶんの増分は持っていない。
              // useLearningSummary が出せるのは週の増分だけなので、期間の表記を合わせる
              footnote={
                completedLessonsDelta != null && completedLessonsDelta > 0
                  ? `今週：+${completedLessonsDelta}レッスン`
                  : null
              }
            />
          </div>
        </div>

        {/* ── 右: 今週の学習時間ゲージ ＋ 今週の目標 ───────────── */}
        <div className="mypage-dash-right">
          <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ ...BLOCK_LABEL_STYLE, alignSelf: 'flex-start', marginBottom: 12 }}>
              <span style={{ width: 9, height: 9, borderRadius: 9999, background: '#2BB49A' }} />
              今週の学習時間
            </div>

            <div style={{ position: 'relative', width: 128, height: 128, margin: 'auto 0' }}>
              <svg width="128" height="128" viewBox="0 0 118 118" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="59" cy="59" r={RING_R} fill="none" stroke="#F8E3E6" strokeWidth="9" />
                <circle
                  cx="59"
                  cy="59"
                  r={RING_R}
                  fill="none"
                  stroke="var(--dc-primary)"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={`${filled} ${RING_C - filled}`}
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                }}
              >
                <div style={{ fontSize: 'var(--dc-fs-4xs)', color: 'var(--dc-text-subtle)' }}>合計</div>
                <div
                  className="dc-num"
                  style={{ fontSize: 'var(--dc-fs-kpi-sub)', fontWeight: 800, color: 'var(--dc-primary)', lineHeight: 1.1 }}
                >
                  {loading ? '…' : formatMinutesHM(weekMinutes)}
                </div>
                <div style={{ fontSize: 'var(--dc-fs-4xs)', color: 'var(--dc-text-subtle)' }}>
                  目標 {formatMinutesHM(goalMinutes)}
                </div>
              </div>
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ ...BLOCK_LABEL_STYLE, marginBottom: 10 }}>
              <span style={{ width: 9, height: 9, borderRadius: 9999, background: '#3B82F6' }} />
              今週の目標
              <span style={{ flex: 1 }} />
              <button
                type="button"
                onClick={onEditGoal}
                className="dc-cta-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  border: '1px solid var(--dc-border-strong)',
                  background: 'var(--dc-surface)',
                  borderRadius: 9999,
                  padding: '5px 11px',
                  fontFamily: 'inherit',
                  fontSize: 'var(--dc-fs-3xs)',
                  fontWeight: 700,
                  color: 'var(--dc-text-body)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                目標を変更
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--dc-fs-base)', fontWeight: 700, color: 'var(--dc-text)' }}>目標</span>
              <span
                className="dc-num"
                style={{ fontSize: 'var(--dc-fs-kpi-sub)', fontWeight: 800, color: 'var(--dc-text)', lineHeight: 1 }}
              >
                {formatMinutesHM(goalMinutes)}
              </span>
              <span style={{ fontSize: 'var(--dc-fs-base)', fontWeight: 700, color: 'var(--dc-text-muted)' }}>/ 週</span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 6,
                alignItems: 'end',
                height: BAR_MAX_H + 20,
                marginBottom: 8,
              }}
            >
              {days.map((d) => {
                const h = d.isFuture
                  ? BAR_EMPTY_H
                  : Math.max(BAR_EMPTY_H, Math.round((d.minutes / scaleMax) * BAR_MAX_H));
                const background = d.isFuture || d.minutes === 0
                  ? 'var(--dc-border)'
                  : d.isToday
                    ? 'var(--dc-primary)'
                    : 'var(--dc-bar-past)';
                return (
                  <div
                    key={d.key}
                    title={`${d.label}曜日 ${formatMinutesHM(d.minutes)}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 5,
                      height: '100%',
                    }}
                  >
                    <span
                      className="dc-num"
                      style={{
                        fontSize: 'var(--dc-fs-4xs)',
                        fontWeight: d.isToday ? 800 : 400,
                        color: d.isToday
                          ? 'var(--dc-primary)'
                          : d.isFuture
                            ? 'var(--dc-chevron)'
                            : 'var(--dc-text-muted)',
                      }}
                    >
                      {formatHoursShort(d.minutes)}
                    </span>
                    <div style={{ width: 16, height: h, borderRadius: 8, background }} />
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginBottom: 12 }}>
              {days.map((d) =>
                d.isToday ? (
                  <span
                    key={d.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'var(--dc-fs-4xs)',
                      fontWeight: 800,
                      color: '#fff',
                      background: 'var(--dc-primary)',
                      borderRadius: 9999,
                      width: 22,
                      height: 22,
                      margin: '0 auto',
                    }}
                  >
                    {d.label}
                  </span>
                ) : (
                  <span
                    key={d.key}
                    style={{
                      fontSize: 'var(--dc-fs-4xs)',
                      textAlign: 'center',
                      color: d.isFuture ? 'var(--dc-text-subtle)' : 'var(--dc-text-muted)',
                    }}
                  >
                    {d.label}
                  </span>
                )
              )}
            </div>

            <div style={{ fontSize: 'var(--dc-fs-2xs)', color: 'var(--dc-text-body)', textAlign: 'right' }}>
              {remain > 0 ? (
                <>
                  目標まであと{' '}
                  <strong className="dc-num" style={{ color: 'var(--dc-primary)' }}>
                    {formatMinutesHM(remain)}
                  </strong>
                </>
              ) : (
                <strong style={{ color: 'var(--dc-primary)' }}>今週の目標を達成しました！</strong>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default StudyDashboardCard;
