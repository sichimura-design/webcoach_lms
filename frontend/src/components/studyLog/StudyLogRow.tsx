import { BookOpen } from 'lucide-react';
import { StudySession } from '../../types/studyActivity';
import { formatMinutesHM } from '../../utils/studyStats';
import { formatTime } from '../focus/focusFormat';

/**
 * 学習セッション1件（実データ、Moodleログ由来）。日別詳細パネルが使う。
 * 自動記録の読み取り専用データなので、編集・削除の操作列は持たない
 * （メモ・達成度は日単位の振り返りに分離。DayDetailPanel参照）。
 */
interface StudyLogRowProps {
  session: StudySession;
  /** courseOptions から解決した教材名。無ければ null */
  courseTitle: string | null;
}

export function StudyLogRow({ session, courseTitle }: StudyLogRowProps) {
  return (
    <div
      className="studylog-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderRadius: 'var(--dc-radius-md)',
        border: '1px solid var(--dc-border)',
        background: 'var(--dc-surface)',
        minWidth: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          flex: 'none',
          display: 'grid',
          placeItems: 'center',
          background: courseTitle ? 'var(--dc-soft-100)' : 'var(--dc-sunken)',
          color: courseTitle ? 'var(--dc-primary)' : 'var(--dc-text-subtle)',
        }}
      >
        <BookOpen size={15} strokeWidth={1.75} />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--dc-fs-body)',
            fontWeight: 600,
            color: courseTitle ? 'var(--dc-text)' : 'var(--dc-text-muted)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {courseTitle ?? '教材を指定しない'}
        </div>
        <div
          style={{
            fontSize: 'var(--dc-fs-caption)',
            color: 'var(--dc-text-subtle)',
            marginTop: 3,
          }}
        >
          {formatTime(session.started_at)}
        </div>
      </div>

      <span
        className="dc-num"
        style={{
          fontSize: 'var(--dc-fs-body)',
          fontWeight: 700,
          color: 'var(--dc-text-body)',
          flex: 'none',
        }}
      >
        {formatMinutesHM(session.duration_minutes)}
      </span>
    </div>
  );
}

/** 記録がまだ無いときの空状態（--dc-* 版） */
export function EmptyStudyLog({ message }: { message?: string }) {
  return (
    <div
      style={{
        border: '1px dashed var(--dc-idle-dash)',
        borderRadius: 'var(--dc-radius-md)',
        padding: '22px 16px',
        textAlign: 'center',
        fontSize: 'var(--dc-fs-caption)',
        color: 'var(--dc-text-subtle)',
        lineHeight: 1.9,
      }}
    >
      {message ?? 'まだ記録がありません。学習を始めると、ここに残ります。'}
    </div>
  );
}

export default StudyLogRow;
