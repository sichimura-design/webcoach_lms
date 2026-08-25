import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Clock } from 'lucide-react';
import { StudyStatsSummary } from '../../types/studyActivity';
import { formatMinutesHM, splitMinutesHM, toLocalDateKey, weekStartOf } from '../../utils/studyStats';

/**
 * 学習記録（マイページ左下）。claude.ai/design『トップページ 3案』5a 準拠。
 *
 * KPI 3つ（今週・累計・修了レッスン数）と今週の棒グラフだけを載せる。
 * 期間切替・ランキング・履歴は /study-log に任せる（数字の置き場を分散させない）。
 *
 * 🔴 まだ来ていない曜日を「未学習」の灰色の棒にしない。
 *    金曜に見ると土日が2本ぶん凹んで見え、まだ起きていない不足を先に見せることになる。
 *    未来は極薄のスタブにして、判定していないことを形で示す
 *    （旧「今週の学習状況」ドット列から引き継いだ方針）。
 */
interface StudyRecordCardProps {
  stats: StudyStatsSummary | null;
  loading: boolean;
  /** 修了レッスン数（コースの進捗率からの推定値） */
  completedLessons: number;
}

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

/** 棒の描画高さ（px）。ラベルと曜日を足して 172px に収まる */
const BAR_MAX_H = 118;
/** 実績0分の過去日に残す最小の芯。棒が消えると「その日が無い」ように見える */
const EMPTY_H = 14;
/** 未来日のスタブ */
const FUTURE_H = 8;

type Bar = {
  key: string;
  label: string;
  minutes: number;
  isToday: boolean;
  isFuture: boolean;
};

/**
 * 目盛りの上限。30分 → 1時間 → 2時間 → 1時間刻み、と段階的に上げる。
 * 🔴 一律 2時間を下限にすると、実績が30分の週で棒が背丈の1/4しか立たず、
 *    グラフの上半分が空白になって「使われていない面」に見える。
 *    週ごとに目盛りを合わせて、棒がちゃんと立つようにする。
 */
function scaleMaxOf(minutes: number[]): number {
  const peak = Math.max(0, ...minutes);
  if (peak <= 30) return 30;
  if (peak <= 60) return 60;
  if (peak <= 120) return 120;
  return Math.ceil(peak / 60) * 60;
}

function MiniStat({ label, parts }: { label: string; parts: { value: string; unit: string }[] }) {
  return (
    <div
      style={{
        border: '1px solid var(--dc-border)',
        borderRadius: 'var(--dc-radius-md)',
        padding: '15px 16px',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 'var(--dc-fs-2xs)', color: 'var(--dc-text-muted)', marginBottom: 6, whiteSpace: 'nowrap' }}>
        {label}
      </div>
      <div
        className="dc-num"
        style={{ fontSize: 'var(--dc-fs-kpi-sub)', fontWeight: 800, color: 'var(--dc-text)', whiteSpace: 'nowrap' }}
      >
        {parts.map((p, i) => (
          <span key={i}>
            <span style={{ fontSize: 'var(--dc-fs-lg)' }}>{p.value}</span>
            {p.unit}
          </span>
        ))}
      </div>
    </div>
  );
}

export function StudyRecordCard({ stats, loading, completedLessons }: StudyRecordCardProps) {
  const navigate = useNavigate();

  // 今週（月曜起点）の7日ぶんを dailyTotals から引く。
  // dailyTotals は欠損日も 0 で埋めた連続配列（既定35日ぶん）なので必ず収まる。
  const { bars, rangeLabel } = useMemo(() => {
    const byDate = new Map((stats?.dailyTotals ?? []).map((d) => [d.date, d]));
    const today = new Date();
    const todayKey = toLocalDateKey(today);
    const start = weekStartOf(today);

    const list: Bar[] = WEEKDAY_LABELS.map((label, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = toLocalDateKey(d);
      return {
        key,
        label,
        minutes: byDate.get(key)?.minutes ?? 0,
        isToday: key === todayKey,
        isFuture: key > todayKey,
      };
    });

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (d: Date, w: string) => `${d.getMonth() + 1}/${d.getDate()}（${w}）`;

    return { bars: list, rangeLabel: `${fmt(start, '月')} 〜 ${fmt(end, '日')}` };
  }, [stats]);

  const scaleMax = scaleMaxOf(bars.map((b) => b.minutes));
  const loadingParts = [{ value: '…', unit: '' }];

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
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
        <button
          type="button"
          onClick={() => navigate('/study-log')}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            border: 0,
            background: 'transparent',
            padding: 0,
            fontFamily: 'inherit',
            fontSize: 'var(--dc-fs-xs)',
            fontWeight: 600,
            color: 'var(--dc-primary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          詳しく見る
          <ChevronRight size={14} strokeWidth={2} />
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 14,
          marginBottom: 28,
        }}
      >
        <MiniStat label="今週の学習時間" parts={loading ? loadingParts : splitMinutesHM(stats?.week.minutes ?? 0)} />
        <MiniStat label="累計学習時間" parts={loading ? loadingParts : splitMinutesHM(stats?.allTime.minutes ?? 0)} />
        <MiniStat
          label="修了レッスン数"
          parts={loading ? loadingParts : [{ value: String(completedLessons), unit: '' }]}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 'var(--dc-fs-sm)', fontWeight: 700, color: 'var(--dc-text)' }}>今週の学習時間</div>
        <div className="dc-num" style={{ fontSize: 'var(--dc-fs-2xs)', color: 'var(--dc-text-subtle)' }}>{rangeLabel}</div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <div
          className="dc-num"
          aria-hidden="true"
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: 172,
            paddingBottom: 22,
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

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'flex-end',
            gap: 14,
            height: 172,
            borderBottom: '1px solid var(--dc-border)',
            padding: '0 6px',
          }}
        >
          {bars.map((b) => {
            const h = b.isFuture
              ? FUTURE_H
              : Math.max(EMPTY_H, Math.round((b.minutes / scaleMax) * BAR_MAX_H));
            const background = b.isFuture
              ? '#F2EDE5'
              : b.isToday
                ? 'var(--dc-primary)'
                : '#EAE4DA';

            return (
              <div
                key={b.key}
                title={`${b.label}曜日 ${formatMinutesHM(b.minutes)}`}
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
                {!b.isFuture && b.minutes > 0 && (
                  <div
                    className="dc-num"
                    style={{
                      fontSize: 'var(--dc-fs-3xs)',
                      marginBottom: 4,
                      whiteSpace: 'nowrap',
                      fontWeight: b.isToday ? 700 : 400,
                      color: b.isToday ? 'var(--dc-primary)' : 'var(--dc-text-subtle)',
                    }}
                  >
                    {formatMinutesHM(b.minutes)}
                  </div>
                )}
                <div style={{ width: 26, height: h, borderRadius: '6px 6px 0 0', background }} />
                <div
                  style={{
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: 'var(--dc-fs-xs)',
                    fontWeight: b.isToday ? 700 : 400,
                    color: b.isToday
                      ? 'var(--dc-primary)'
                      : b.isFuture
                        ? 'var(--dc-text-subtle)'
                        : 'var(--dc-text-muted)',
                  }}
                >
                  {b.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default StudyRecordCard;
