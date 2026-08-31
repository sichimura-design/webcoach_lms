import { useMemo, useState } from 'react';
import { Flame } from 'lucide-react';
import { StudyStatsSummary } from '../../types/studyActivity';
import { formatMinutesHM, toLocalDateKey } from '../../utils/studyStats';

/**
 * ストリークカレンダー（/study-log の②）。claude.ai/design『トップページ 3案』4a 準拠。
 *
 * マイページのストリークが「何日続いているか」だけを見せるのに対し、
 * こちらは「いつ空いたのか」を月単位で見せる。空白の場所が分かると、
 * 曜日の偏り（週末に途切れているなど）に自分で気づける。
 *
 * 🔴 達成判定は StudyDayTotal.isStudyDay をそのまま使う。閾値をここで再実装しない。
 * 🔴 取得済みは92日ぶんなので、遡れるのは3か月前まで。
 *    それ以前は「記録が無い」ではなく「まだ読んでいない」なので、ボタンごと止める。
 */
interface StreakCalendarCardProps {
  stats: StudyStatsSummary | null;
  loading: boolean;
}

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

/** 月曜始まりの曜日インデックス（0=月 … 6=日） */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

interface Cell {
  key: string;
  /** 月外の空セル */
  blank: boolean;
  day: number;
  studied: boolean;
  isToday: boolean;
  isFuture: boolean;
  tip: string;
}

export function StreakCalendarCard({ stats, loading }: StreakCalendarCardProps) {
  /** 0 = 今月。-2 まで（取得済み92日ぶんの範囲） */
  const [monthOffset, setMonthOffset] = useState(0);

  const { cells, title } = useMemo(() => {
    const byDate = new Map((stats?.dailyTotals ?? []).map((d) => [d.date, d]));
    const today = new Date();
    const todayKey = toLocalDateKey(today);

    const first = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const lead = mondayIndex(first);

    // 6週ぶんの42セル固定。月をまたいでも高さが変わらず、切り替えで画面が跳ねない
    const list: Cell[] = Array.from({ length: 42 }, (_, i) => {
      const day = i - lead + 1;
      if (day < 1 || day > daysInMonth) {
        return { key: `blank-${i}`, blank: true, day: 0, studied: false, isToday: false, isFuture: false, tip: '' };
      }
      const d = new Date(first.getFullYear(), first.getMonth(), day);
      const key = toLocalDateKey(d);
      const hit = byDate.get(key);
      return {
        key,
        blank: false,
        day,
        studied: hit?.isStudyDay ?? false,
        isToday: key === todayKey,
        isFuture: key > todayKey,
        tip: `${key} ${formatMinutesHM(hit?.minutes ?? 0)}`,
      };
    });

    return { cells: list, title: `${first.getFullYear()}年${first.getMonth() + 1}月` };
  }, [stats, monthOffset]);

  const threshold = stats?.streak.thresholdMinutes ?? 10;
  const canGoBack = monthOffset > -2;
  const canGoForward = monthOffset < 0;

  const navButton = (label: string, glyph: string, enabled: boolean, onClick: () => void) => (
    <button
      type="button"
      aria-label={label}
      disabled={!enabled}
      onClick={onClick}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{
        width: 24,
        height: 24,
        borderRadius: 9999,
        border: '1px solid var(--dc-border-strong)',
        background: '#fff',
        display: 'grid',
        placeItems: 'center',
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
            width: 'var(--dc-sz-badge)',
            height: 'var(--dc-sz-badge)',
            flex: 'none',
            borderRadius: 9999,
            background: 'var(--dc-gold-surface)',
            color: 'var(--dc-gold)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Flame size={16} strokeWidth={1.75} />
        </span>
        <h2
          style={{
            margin: 0,
            flex: 1,
            fontSize: 'var(--dc-fs-lead)',
            fontWeight: 700,
            color: 'var(--dc-text)',
            whiteSpace: 'nowrap',
          }}
        >
          ストリークカレンダー
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {navButton('前の月へ', '‹', canGoBack, () => setMonthOffset((m) => m - 1))}
          <span className="dc-num" style={{ fontSize: 'var(--dc-fs-body)', fontWeight: 600, color: 'var(--dc-text-body)', whiteSpace: 'nowrap' }}>
            {title}
          </span>
          {navButton('次の月へ', '›', canGoForward, () => setMonthOffset((m) => Math.min(0, m + 1)))}
        </div>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, marginBottom: 8 }}
        aria-hidden="true"
      >
        {WEEKDAY_LABELS.map((w) => (
          <span key={w} style={{ textAlign: 'center', fontSize: 'var(--dc-fs-caption)', fontWeight: 600, color: 'var(--dc-text-subtle)' }}>
            {w}
          </span>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
        {cells.map((c) => {
          if (c.blank) return <span key={c.key} style={{ height: 'var(--dc-sz-cell)' }} />;

          return (
            <span
              key={c.key}
              title={c.tip}
              aria-current={c.isToday ? 'date' : undefined}
              style={{
                height: 'var(--dc-sz-cell)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 1,
                borderRadius: 10,
                boxSizing: 'border-box',
                background: c.studied ? 'var(--dc-soft-100)' : c.isFuture ? 'transparent' : 'var(--dc-sunken)',
                border: c.isToday
                  ? '2px solid var(--dc-primary)'
                  : c.studied
                    ? '1px solid var(--dc-soft-200)'
                    : '1px solid var(--dc-border)',
              }}
            >
              <span
                className="dc-num"
                style={{
                  fontSize: 'var(--dc-fs-caption)',
                  fontWeight: c.studied || c.isToday ? 700 : 400,
                  color: c.studied
                    ? 'var(--dc-primary)'
                    : c.isFuture
                      ? 'var(--dc-text-subtle)'
                      : 'var(--dc-text-muted)',
                }}
              >
                {c.day}
              </span>
              {/* 色だけで達成を伝えない（DESIGN.md §7）。高さは常に確保して升目を揃える */}
              {c.studied ? (
                <Flame size={14} strokeWidth={2} color="var(--dc-gold)" aria-hidden="true" />
              ) : (
                <span style={{ height: 14 }} />
              )}
            </span>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 12,
          fontSize: 'var(--dc-fs-caption)',
          color: 'var(--dc-text-muted)',
          flexWrap: 'wrap',
        }}
      >
        <Flame size={14} strokeWidth={2} color="var(--dc-gold)" aria-hidden="true" />
        <span>＝学習した日（{loading ? '…' : `${threshold}分以上`}）</span>
        <span style={{ marginLeft: 14, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            aria-hidden="true"
            style={{ width: 14, height: 14, borderRadius: 5, border: '2px solid var(--dc-primary)', display: 'inline-block' }}
          />
          ＝今日
        </span>
      </div>
    </section>
  );
}

export default StreakCalendarCard;
