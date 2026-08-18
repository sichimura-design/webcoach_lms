import { ChevronLeft, ChevronRight } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import { formatMonthLabel } from './focusFormat';

/**
 * 学習日カレンダー(月表示)。
 * primary = 学習した日 / streakOff = 学習しなかった日(過ぎた日) / transparent = 未来
 */
interface StudyCalendarProps {
  year: number;
  /** 0 = 1月 */
  month: number;
  /** 学習した日のキー(YYYY-MM-DD) */
  studiedDates: Set<string>;
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const navButton: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: '50%',
  border: `1px solid ${color.borderSoft}`,
  background: color.surface,
  color: color.textMuted,
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  flexShrink: 0,
};

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function StudyCalendar({ year, month, studiedDates, onPrev, onNext, canPrev, canNext }: StudyCalendarProps) {
  const now = new Date();
  const todayKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = new Date(year, month, 1).getDay();

  const cells: (number | null)[] = [
    ...new Array<null>(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 12 }}>
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          aria-label="前の月"
          className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{ ...navButton, opacity: canPrev ? 1 : 0.35, cursor: canPrev ? 'pointer' : 'not-allowed' }}
        >
          <ChevronLeft size={15} />
        </button>
        <span style={{ ...font.rowTitle, color: color.text, minWidth: 108, textAlign: 'center' }}>
          {formatMonthLabel(year, month)}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          aria-label="次の月"
          className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{ ...navButton, opacity: canNext ? 1 : 0.35, cursor: canNext ? 'pointer' : 'not-allowed' }}
        >
          <ChevronRight size={15} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {WEEKDAYS.map((w) => (
          <div key={w} style={{ ...font.caption, color: color.textSubtle, textAlign: 'center' }}>
            {w}
          </div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} />;
          const key = dateKey(year, month, day);
          const studied = studiedDates.has(key);
          const future = key > todayKey;
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              title={`${month + 1}月${day}日${studied ? '・学習あり' : ''}`}
              style={{
                height: 32,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 8,
                fontSize: 11.5,
                fontWeight: studied ? 700 : 500,
                fontVariantNumeric: 'tabular-nums',
                background: studied ? color.primary : future ? 'transparent' : color.streakOff,
                color: studied ? color.textOnPrimary : future ? color.textFaint : color.textSubtle,
                boxShadow: isToday ? `0 0 0 2px ${color.surface}, 0 0 0 3px ${color.primaryBorder}` : undefined,
              }}
            >
              {day}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 12, justifyContent: 'center' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: color.primary }} />
          <span style={{ ...font.caption, color: color.textSubtle }}>学習した日</span>
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: color.streakOff }} />
          <span style={{ ...font.caption, color: color.textSubtle }}>学習していない日</span>
        </span>
      </div>
    </div>
  );
}

export default StudyCalendar;
