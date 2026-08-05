import { useMemo, useState } from 'react';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { StudyStatsSummary } from '../../types/studyActivity';
import { formatMinutesHM } from '../../utils/studyStats';
import StudyCalendar from './StudyCalendar';

/**
 * 学習の継続。現在の連続日数・過去最長・今月の学習日数＋学習日カレンダー。
 * ログイン日数ではなく「1日に合計◯分以上学習した日」を数える（閾値は stats.streak が持つ）。
 */
interface StreakCalendarCardProps {
  stats: StudyStatsSummary | null;
  /** カレンダーに塗る学習日。dailyTotals の範囲外の月は塗られない旨を注記する */
  loading: boolean;
}

/** カレンダーで遡れる月数 */
const MAX_MONTHS_BACK = 11;

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
      <div
        style={{
          ...font.streakNumber,
          color: accent ? color.primary : color.text,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <div style={{ ...font.caption, color: color.textSubtle, marginTop: 3 }}>{label}</div>
    </div>
  );
}

export function StreakCalendarCard({ stats, loading }: StreakCalendarCardProps) {
  const now = new Date();
  const [offset, setOffset] = useState(0); // 0 = 当月

  const shown = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset, now.getFullYear(), now.getMonth()]);

  const studiedDates = useMemo(
    () =>
      new Set(
        (stats?.dailyTotals ?? []).filter((d) => d.isStudyDay).map((d) => d.date)
      ),
    [stats]
  );

  const streak = stats?.streak;
  const dash = loading ? '…' : '—';

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
        <Metric
          label="連続学習日数"
          value={streak ? `🔥 ${streak.currentDays}日` : dash}
          accent
        />
        <div style={{ width: 1, height: 22, background: color.divider }} />
        <Metric label="過去最長" value={streak ? `${streak.bestDays}日` : dash} />
        <div style={{ width: 1, height: 22, background: color.divider }} />
        <Metric label="今月の学習日数" value={streak ? `${streak.monthStudyDays}日` : dash} />
      </div>

      {streak && !streak.todayAchieved && (
        <div
          style={{
            background: color.primaryTint,
            border: `1px solid ${color.primaryBorder}`,
            borderRadius: radius.md,
            padding: '10px 14px',
            ...font.caption,
            color: color.textBody,
          }}
        >
          今日はあと {formatMinutesHM(Math.max(0, streak.thresholdMinutes - streak.todayMinutes))}{' '}
          学習すると、学習した日として記録されます。
        </div>
      )}

      <StudyCalendar
        year={shown.year}
        month={shown.month}
        studiedDates={studiedDates}
        onPrev={() => setOffset((o) => Math.min(MAX_MONTHS_BACK, o + 1))}
        onNext={() => setOffset((o) => Math.max(0, o - 1))}
        canPrev={offset < MAX_MONTHS_BACK}
        canNext={offset > 0}
      />
    </div>
  );
}

export default StreakCalendarCard;
