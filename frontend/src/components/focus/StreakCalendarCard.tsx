import { useMemo } from 'react';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { StudyCalendarDay, StudyStreakInfo } from '../../types/studyActivity';
import StudyCalendar from './StudyCalendar';

/**
 * 学習の継続。連続日数(学習ストリーク)＋学習日カレンダー。
 * 「アプリを開いた日」ではなく「1回以上、集中ブースの学習セッションを完了した日」を数える
 * (ログインストリークとは独立した別指標)。
 */
interface StreakCalendarCardProps {
  streak: StudyStreakInfo | null;
  calendarDays: StudyCalendarDay[];
  calendarYear: number;
  /** 0 = 1月 */
  calendarMonth: number;
  onMonthChange: (year: number, month: number) => void;
  loading: boolean;
}

/** カレンダーで遡れる月数 */
const MAX_MONTHS_BACK = 11;

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
      <div style={{ ...font.streakNumber, color: accent ? color.primary : color.text, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ ...font.caption, color: color.textSubtle, marginTop: 3 }}>{label}</div>
    </div>
  );
}

export function StreakCalendarCard({
  streak,
  calendarDays,
  calendarYear,
  calendarMonth,
  onMonthChange,
  loading,
}: StreakCalendarCardProps) {
  const now = new Date();
  const monthsBack = (now.getFullYear() - calendarYear) * 12 + (now.getMonth() - calendarMonth);

  const studiedDates = useMemo(
    () => new Set(calendarDays.filter((d) => d.total_minutes > 0).map((d) => d.date)),
    [calendarDays]
  );

  const dash = loading ? '…' : '—';

  const goToMonth = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    onMonthChange(d.getFullYear(), d.getMonth());
  };

  return (
    <div
      className="flex flex-col"
      style={{
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.card,
        boxShadow: shadow.card,
        padding: '20px 22px 18px',
        gap: 16,
      }}
    >
      <h2 style={{ ...font.cardTitle, color: color.text, margin: 0 }}>学習の継続</h2>

      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Metric label="連続学習日数" value={streak ? `🔥 ${streak.current_streak}日` : dash} accent />
      </div>

      <StudyCalendar
        year={calendarYear}
        month={calendarMonth}
        studiedDates={studiedDates}
        onPrev={() => goToMonth(monthsBack + 1)}
        onNext={() => goToMonth(monthsBack - 1)}
        canPrev={monthsBack < MAX_MONTHS_BACK}
        canNext={monthsBack > 0}
      />
    </div>
  );
}

export default StreakCalendarCard;
