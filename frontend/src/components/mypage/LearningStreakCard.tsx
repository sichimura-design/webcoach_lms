import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { addDays, format, subDays } from 'date-fns';
import { StudyStatsSummary } from '../../types/studyActivity';
import { formatMinutesHM, weekStartOf } from '../../utils/studyStats';

/**
 * 継続記録（ストリーク）のカード。claude.ai/design『マイページ 3d.dc.html』準拠。
 *
 * 🔴 日数はログイン日数ではなく「実際に学習した日数」。
 *    集計は utils/studyStats.ts が唯一の実装で、集中ブース・学習ログ・ここが同じ値を見る。
 *    各日の達成判定も StudyDayTotal.isStudyDay（= minutes >= STUDY_DAY_MIN_MINUTES）を
 *    そのまま使い、ここで閾値を再実装しない。
 *
 * 🔴 CTAは塗りつぶしの赤にしない。塗りつぶしの赤はこのページでは
 *    「続きから学習する」1つだけ、という対比を保つため（DESIGN.md §15-5）。
 *
 * 🔴 かつてここには炎・トロフィーのスプライトと紙吹雪を重ねていたが、
 *    デザインが「小さな炎 + 2週間カレンダー」に整理されたので撤去した。
 *    お祝いの演出はこのカードの炎と「N日連続中！」の1つだけ（DESIGN.md §1-7）。
 */
interface LearningStreakCardProps {
  stats: StudyStatsSummary | null;
  loading: boolean;
}

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

/** 月曜始まりの曜日インデックス（0=月 … 6=日） */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** 2色の炎。lucide の Flame は単色なのでここだけインラインSVG（DESIGN.md §11 の例外） */
function FlameIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"
        fill="var(--dc-gold)"
      />
      <path
        d="M12 21a4 4 0 0 0 4-4c0-1.2-.6-2.3-1.5-3.2-.7 1-1.6 1.6-2.5 1.7-1 .1-2-.5-2.4-1.5-.9 1-1.6 2-1.6 3A4 4 0 0 0 12 21z"
        fill="#FDE8C5"
      />
    </svg>
  );
}

type Cell = { key: string; date: number; studied: boolean; isToday: boolean; isFuture: boolean };

/**
 * 先週の月曜からの14日ぶんを2行に組む。
 * 🔴 デザインHTMLは todayG = 11（8/3始まりの12日目）を直書きしているが、
 *    ここでは実データの日付から組む。stats.dailyTotals は欠損日も0で埋めた連続配列
 *    （既定35日ぶん）なので、14日ならつねに収まる。
 *    今週の未来日は dailyTotals に無いので studied=false / isFuture=true になる。
 */
function buildWeeks(stats: StudyStatsSummary | null, today: Date): Cell[][] {
  const byDate = new Map((stats?.dailyTotals ?? []).map((d) => [d.date, d]));
  const start = subDays(weekStartOf(today), 7);
  const todayKey = format(today, 'yyyy-MM-dd');

  return [0, 1].map((week) =>
    Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, week * 7 + i);
      const key = format(d, 'yyyy-MM-dd');
      return {
        key,
        date: d.getDate(),
        studied: byDate.get(key)?.isStudyDay ?? false,
        isToday: key === todayKey,
        isFuture: key > todayKey,
      };
    })
  );
}

function DayCell({ cell }: { cell: Cell }) {
  const base: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 9999,
    display: 'grid',
    placeItems: 'center',
    boxSizing: 'border-box',
    fontSize: 12,
    fontWeight: 600,
  };

  let style: React.CSSProperties;
  if (cell.studied) {
    style = { ...base, background: 'var(--dc-primary)', color: '#fff', fontWeight: 700 };
    // 当日かつ達成ずみは二重リングで「今日」を示す（色だけに頼らない）
    if (cell.isToday) style.boxShadow = '0 0 0 2px #fff, 0 0 0 4px var(--dc-primary)';
  } else if (cell.isToday) {
    style = { ...base, background: '#fff', border: '2px solid var(--dc-primary)', color: 'var(--dc-primary)', fontWeight: 700 };
  } else {
    style = { ...base, background: 'var(--dc-sunken)', color: cell.isFuture ? 'var(--dc-text-subtle)' : 'var(--dc-text-muted)' };
  }

  return (
    <span style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
      <span className="dc-num" style={style} aria-current={cell.isToday ? 'date' : undefined}>
        {cell.date}
      </span>
    </span>
  );
}

export function LearningStreakCard({ stats, loading }: LearningStreakCardProps) {
  const navigate = useNavigate();
  const today = new Date();
  const streak = stats?.streak;
  const current = streak?.currentDays ?? 0;
  const best = streak?.bestDays ?? 0;
  const isNewBest = current > 0 && current >= best;
  const remain = Math.max(0, best - current);

  // 今日ぶんが未成立なら、あと何分で成立するかを出す。この情報の置き場はここ1箇所。
  const shortfall = streak && !streak.todayAchieved ? Math.max(0, streak.thresholdMinutes - streak.todayMinutes) : 0;

  const weeks = buildWeeks(stats, today);
  const todayCol = mondayIndex(today);
  // 桁が増えても「日連続中！」とぶつからないように数字だけ縮める（デザインは 10日以上で 38px）
  const numberSize = current >= 10 ? 32 : 40;

  return (
    <section
      style={{
        background: 'var(--dc-surface)',
        border: '1px solid var(--dc-border)',
        borderRadius: 'var(--dc-radius-lg)',
        boxShadow: 'var(--dc-shadow-card)',
        padding: 22,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span
          style={{ width: 25, height: 25, flex: 'none', borderRadius: 8, background: 'var(--dc-primary)', display: 'grid', placeItems: 'center' }}
        >
          <CalendarDays size={14} strokeWidth={1.75} color="#fff" />
        </span>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--dc-text)' }}>ストリーク</h3>
        {!loading && best > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--dc-text-muted)' }}>
            ベスト記録：
            <span className="dc-num" style={{ fontWeight: 700, color: 'var(--dc-text-body)' }}>
              {Math.max(best, current)}日
            </span>
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 22, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap' }}>
          <span
            style={{
              width: 38,
              height: 38,
              flex: 'none',
              borderRadius: 9999,
              background: '#fff',
              border: '1px solid var(--dc-border)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 4px 10px -6px rgba(60,48,32,.2)',
            }}
          >
            <FlameIcon />
          </span>
          <span>
            <span
              className="dc-num"
              style={{ fontSize: numberSize, fontWeight: 800, color: 'var(--dc-primary)', lineHeight: 1, letterSpacing: '-0.02em' }}
            >
              {loading ? '…' : current}
            </span>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--dc-primary)', marginLeft: 2 }}>日連続中！</span>
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', marginBottom: 8 }} aria-hidden="true">
            {WEEKDAY_LABELS.map((label, i) => (
              <span
                key={label}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontSize: 10.5,
                  fontWeight: i === todayCol ? 700 : 400,
                  color: i === todayCol ? 'var(--dc-primary)' : 'var(--dc-text-subtle)',
                }}
              >
                {label}
              </span>
            ))}
          </div>

          {weeks.map((week, wi) => (
            <div key={wi} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              {week.map((cell) => (
                <DayCell key={cell.key} cell={cell} />
              ))}
            </div>
          ))}

          <div style={{ fontSize: 12, color: 'var(--dc-text-body)', lineHeight: 1.7 }}>
            {loading ? (
              '　'
            ) : (
              <>
                {/*
                  事実 → 励まし の順（DESIGN.md §12）。
                  今日ぶんが未成立のときは、その一手を先に伝える。
                */}
                {shortfall > 0
                  ? `今日はあと ${formatMinutesHM(shortfall)} で「学習した日」になります。`
                  : '素晴らしい継続力です！'}
                <br />
                {isNewBest ? (
                  <span style={{ fontWeight: 700, color: 'var(--dc-gold-text)' }}>自己ベスト更新中！</span>
                ) : remain > 0 ? (
                  <span>
                    あと <span className="dc-num" style={{ fontWeight: 700, color: 'var(--dc-primary)' }}>{remain}日</span> で自己ベスト更新！
                  </span>
                ) : (
                  <span>今日も少しずつ進めましょう。</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/focus-booth')}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          width: '100%',
          background: 'var(--dc-surface)',
          color: 'var(--dc-primary)',
          border: '1px solid var(--dc-primary)',
          borderRadius: 'var(--dc-radius-md)',
          padding: '9px 15px',
          fontSize: 13,
          fontWeight: 700,
          fontFamily: 'inherit',
          cursor: 'pointer',
          transition: 'background 200ms var(--dc-ease)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--dc-tint-50)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--dc-surface)'; }}
      >
        本日も学習を記録する
        <ChevronRight size={15} strokeWidth={2} />
      </button>
    </section>
  );
}

export default LearningStreakCard;
