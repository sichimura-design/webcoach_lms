import { useMemo } from 'react';
import { StudyActivity } from '../../types/studyActivity';
import { formatMinutesHM } from '../../utils/studyStats';
import { formatDayLabel } from '../focus/focusFormat';
import StudyLogRow, { EmptyStudyLog } from './StudyLogRow';

/**
 * すべての学習記録。日付が変わるところに「日付＋その日の合計」の見出しを挟む。
 *
 * 🔴 行は StudyLogRow（--dc-*）を使う。かつては focus/StudySessionRow を借りていたが、
 *    あちらは theme/webcoachTheme（旧トークン系統）で、集中ブースのポップオーバーとも
 *    共用されている。編集・削除のボタンを足すとトークン移行が /study-log の外へ漏れる。
 */
interface StudyLogListProps {
  activities: StudyActivity[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  /** 保存・削除の最中。楽観更新をしないので、待つあいだ行の操作を止める */
  busy?: boolean;
  onLoadMore: () => void;
  onEdit: (activity: StudyActivity) => void;
  onDelete: (activity: StudyActivity) => void;
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
  busy = false,
  onLoadMore,
  onEdit,
  onDelete,
}: StudyLogListProps) {
  const groups = useMemo(() => groupByDay(activities), [activities]);

  if (loading) {
    return (
      <div style={{ fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-subtle)', marginTop: 12 }}>
        読み込んでいます…
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-muted)', marginTop: 12 }}>{error}</div>
    );
  }
  if (activities.length === 0) {
    return (
      <div style={{ marginTop: 12 }}>
        <EmptyStudyLog message="まだ学習記録がありません。学習を始めるか、上の「手動で記録を追加」から足せます。" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {groups.map((g) => (
        <div key={g.date}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              margin: '14px 0 8px',
              fontSize: 'var(--dc-fs-caption)',
              color: 'var(--dc-text-subtle)',
            }}
          >
            <span style={{ fontWeight: 700, color: 'var(--dc-text-body)' }}>
              {formatDayLabel(`${g.date}T00:00:00`)}
            </span>
            <span className="dc-num">合計 {formatMinutesHM(g.totalMinutes)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {g.items.map((a) => (
              <StudyLogRow
                key={a.id}
                activity={a}
                timeOnly
                onEdit={onEdit}
                onDelete={onDelete}
                busy={busy}
              />
            ))}
          </div>
        </div>
      ))}

      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loadingMore}
          className="dc-cta-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            marginTop: 14,
            minHeight: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 9999,
            border: '1px solid var(--dc-border-strong)',
            background: 'var(--dc-surface)',
            fontFamily: 'inherit',
            fontSize: 'var(--dc-fs-body)',
            fontWeight: 700,
            color: 'var(--dc-text-body)',
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
