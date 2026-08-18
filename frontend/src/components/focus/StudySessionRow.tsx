import { BookOpen } from 'lucide-react';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import { StudySession, STUDY_SESSION_MODE_LABEL, StudySessionMode } from '../../types/studyActivity';
import { formatDayTime } from './focusFormat';

interface StudySessionRowProps {
  session: StudySession;
}

export function StudySessionRow({ session }: StudySessionRowProps) {
  const mode: StudySessionMode = session.target_minutes ? 'pomodoro' : 'freeform';
  const meta = [session.started_at ? formatDayTime(session.started_at) : null, STUDY_SESSION_MODE_LABEL[mode]]
    .filter(Boolean)
    .join(' ・ ');

  return (
    <div
      style={{ ...t.listRow }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color.primaryBorderSoft;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = color.border;
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: session.courseid ? color.primarySoft : color.hoverBg,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <BookOpen size={15} style={{ color: session.courseid ? color.primary : color.textFaint }} />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            ...font.rowTitle,
            color: session.courseid ? color.text : color.textMuted,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {session.course_title ?? '教材を指定しない'}
        </div>
        <div
          style={{
            ...font.caption,
            color: color.textSubtle,
            marginTop: 3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {meta}
        </div>
      </div>

      <span style={{ ...font.rowTitle, color: color.textSecondary, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {session.duration_minutes ?? 0}分
      </span>
    </div>
  );
}

/** 記録がまだ無いときの空状態 */
export function EmptySessions({ message }: { message?: string }) {
  return (
    <div
      style={{
        border: `1px dashed ${color.primaryDashed}`,
        borderRadius: radius.md,
        padding: '22px 16px',
        textAlign: 'center',
        ...font.caption,
        color: color.textSubtle,
        lineHeight: 1.9,
      }}
    >
      {message ?? 'まだ記録がありません。タイマーを開始すると、ここに残ります。'}
    </div>
  );
}

export default StudySessionRow;
