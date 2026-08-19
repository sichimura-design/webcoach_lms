import { BookOpen } from 'lucide-react';
import { color, font, radius, t } from '../../theme/webcoachTheme';
import { StudySession } from '../../types/studyActivity';
import { formatDayTime } from './focusFormat';

interface StudySessionRowProps {
  session: StudySession;
}

export function StudySessionRow({ session }: StudySessionRowProps) {
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
