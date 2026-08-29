import { BookOpen } from 'lucide-react';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import { ACHIEVEMENT_LABEL, StudyActivity, StudySession } from '../../types/studyActivity';
import { STUDY_SESSION_MODE_LABEL } from '../../types/studyRoom';
import { formatMinutesHM } from '../../utils/studyStats';
import { formatDayTime, formatTime } from './focusFormat';

/**
 * 学習記録の1行。集中ブース（dev/kanegae実装, StudySession）と /study-log
 * （dev/miyabe実装, StudyActivity）で行の見た目を共用するため、どちらの型でも
 * 描画できるようにしてある（プロパティで判別）。
 */
interface StudySessionRowProps {
  /** dev/kanegae: 実API(GET /api/study/sessions/{userid}/recent)由来の行 */
  session?: StudySession;
  /** dev/miyabe: モック(StudyActivity)由来の行 */
  activity?: StudyActivity;
  /** 日付グループの中で使うときは時刻だけ出す（日付は見出しにあるので重複させない）。activity専用 */
  timeOnly?: boolean;
}

export function StudySessionRow({ session, activity, timeOnly }: StudySessionRowProps) {
  if (activity) {
    const { session: payload, course } = activity;
    const meta = [
      timeOnly ? formatTime(activity.startedAt) : formatDayTime(activity.startedAt),
      STUDY_SESSION_MODE_LABEL[payload.mode],
      payload.achievement ? ACHIEVEMENT_LABEL[payload.achievement] : null,
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
          {formatMinutesHM(payload.durationMinutes)}
        </span>
      </div>
    );
  }

  if (!session) return null;

  // モード(通常/ポモドーロ)・コース名はMoodleログには残らないクライアント側限定の情報のため、
  // 完了済みセッション一覧では表示しない(開始/終了時刻とコースの有無・学習時間のみ表示)。
  const meta = session.started_at ? formatDayTime(session.started_at) : '';

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
          {session.courseid ? `コースID ${session.courseid}` : '教材を指定しない'}
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
