import { useMemo } from 'react';
import { color, font, t } from '../../theme/webcoachTheme';
import { StudyActivity } from '../../types/studyActivity';
import { formatMinutesHM } from '../../utils/studyStats';
import StudySessionRow, { EmptySessions } from '../focus/StudySessionRow';
import { formatDayLabel } from '../focus/focusFormat';

/**
 * すべての学習記録。日付が変わるところに「日付＋その日の合計」の見出しを挟む。
 * 行は集中ブースと同じ StudySessionRow を使う。
 */
interface StudyLogListProps {
  activities: StudyActivity[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  onLoadMore: () => void;
}

interface DayGroup {
  date: string;
  totalMinutes: number;
  items: StudyActivity[];
}

function groupByDay(activities: StudyActivity[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const a of activities) {
    const last = groups[groups.length - 1];
    if (last && last.date === a.localDate) {
      last.items.push(a);
      last.totalMinutes += a.session.durationMinutes;
    } else {
      groups.push({
        date: a.localDate,
        totalMinutes: a.session.durationMinutes,
        items: [a],
      });
    }
  }
  return groups;
}

export function StudyLogList({
  activities,
  loading,
  loadingMore,
  hasMore,
  error,
  onLoadMore,
}: StudyLogListProps) {
  const groups = useMemo(() => groupByDay(activities), [activities]);

  if (loading) {
    return <div style={{ ...font.caption, color: color.textSubtle }}>読み込んでいます…</div>;
  }
  if (error) {
    return <div style={{ ...font.meta, color: color.textMuted }}>{error}</div>;
  }
  if (activities.length === 0) {
    return <EmptySessions message="この期間の学習記録はまだありません。" />;
  }

  return (
    <div className="flex flex-col" style={{ gap: 6 }}>
      {groups.map((g) => (
        <div key={g.date}>
          <div
            style={{
              ...font.caption,
              color: color.textSubtle,
              margin: '14px 0 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontWeight: 700, color: color.textBody }}>{formatDayLabel(g.date)}</span>
            <span>合計 {formatMinutesHM(g.totalMinutes)}</span>
          </div>
          <div className="flex flex-col" style={{ gap: 10 }}>
            {g.items.map((a) => (
              <StudySessionRow key={a.id} activity={a} timeOnly />
            ))}
          </div>
        </div>
      ))}

      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            ...t.ghostButton,
            marginTop: 14,
            justifyContent: 'center',
            cursor: loadingMore ? 'default' : 'pointer',
            opacity: loadingMore ? 0.6 : 1,
          }}
        >
          {loadingMore ? '読み込んでいます…' : 'さらに古い記録を見る ⌄'}
        </button>
      )}
    </div>
  );
}

export default StudyLogList;
