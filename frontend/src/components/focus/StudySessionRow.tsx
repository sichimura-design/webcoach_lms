import { BookOpen } from 'lucide-react';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import { ACHIEVEMENT_LABEL, StudyActivity } from '../../types/studyActivity';
import { STUDY_SESSION_MODE_LABEL } from '../../types/studyRoom';
import { formatMinutesHM } from '../../utils/studyStats';
import { formatDayTime, formatTime } from './focusFormat';

/**
 * 学習記録の1行。集中ブースの「最近の学習記録」と /study-log の一覧で共用する。
 */
interface StudySessionRowProps {
  activity: StudyActivity;
  /** 日付グループの中で使うときは時刻だけ出す（日付は見出しにあるので重複させない） */
  timeOnly?: boolean;
}

export function StudySessionRow({ activity, timeOnly }: StudySessionRowProps) {
  const { session, course } = activity;
  const meta = [
    timeOnly ? formatTime(activity.startedAt) : formatDayTime(activity.startedAt),
    STUDY_SESSION_MODE_LABEL[session.mode],
    session.achievement ? ACHIEVEMENT_LABEL[session.achievement] : null,
  ]
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
          background: course ? color.primarySoft : color.hoverBg,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <BookOpen size={15} style={{ color: course ? color.primary : color.textFaint }} />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            ...font.rowTitle,
            color: course ? color.text : color.textMuted,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {course?.courseTitle ?? '教材を指定しない'}
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

      <span
        style={{
          ...font.rowTitle,
          color: color.textSecondary,
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}
      >
        {formatMinutesHM(session.durationMinutes)}
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
