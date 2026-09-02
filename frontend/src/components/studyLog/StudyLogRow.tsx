import { BookOpen, Pencil, Trash2 } from 'lucide-react';
import {
  ACHIEVEMENT_LABEL,
  STUDY_CATEGORY_LABEL,
  StudyActivity,
} from '../../types/studyActivity';
import {
  displaySegments,
  formatMinutesHM,
  isEditedEntry,
  isManualEntry,
} from '../../utils/studyStats';
import { formatDayTime, formatTime } from '../focus/focusFormat';

/**
 * 学習記録の1行。学習履歴の一覧とカレンダーの日別詳細で共用する。
 * ============================================================
 * 🔴 focus/StudySessionRow とは別物。あちらは theme/webcoachTheme（旧トークン系統）で
 *    組まれていて、集中ブースのポップオーバーや「最近の学習記録」でも使われている。
 *    そちらに編集ボタンを足すと --dc-* への移行が /study-log の外へ漏れるので、
 *    /study-log 用にこちらを持つ。集中ブース側が --dc-* に移ったら統合を検討する。
 *
 * 🔴 「編集済み」と「手動」はチップの色ではなくアイコン＋文字で伝える
 *    （色だけで情報を伝えない）。
 * ============================================================
 */
interface StudyLogRowProps {
  activity: StudyActivity;
  /** 日付グループの中で使うときは時刻だけ出す（日付は見出しにあるので重複させない） */
  timeOnly?: boolean;
  /** 未指定なら操作列そのものを出さない（読み取り専用の場所で使うため） */
  onEdit?: (activity: StudyActivity) => void;
  onDelete?: (activity: StudyActivity) => void;
  /** 保存・削除の最中。楽観更新をしないので、待つあいだ操作を止める */
  busy?: boolean;
}

function Chip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '1px 6px',
        borderRadius: 6,
        background: 'var(--dc-sunken)',
        color: 'var(--dc-text-muted)',
        fontSize: 'var(--dc-fs-caption)',
        whiteSpace: 'nowrap',
        flex: 'none',
      }}
    >
      {icon}
      {label}
    </span>
  );
}

function iconButton(
  label: string,
  icon: React.ReactNode,
  onClick: () => void,
  busy: boolean,
  danger?: boolean
) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={busy}
      onClick={onClick}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        border: '1px solid var(--dc-border)',
        background: 'var(--dc-surface)',
        color: danger ? 'var(--dc-primary)' : 'var(--dc-text-muted)',
        display: 'grid',
        placeItems: 'center',
        cursor: busy ? 'default' : 'pointer',
        opacity: busy ? 0.5 : 1,
        flex: 'none',
      }}
    >
      {icon}
    </button>
  );
}

export function StudyLogRow({ activity, timeOnly, onEdit, onDelete, busy = false }: StudyLogRowProps) {
  const { session, course } = activity;
  const manual = isManualEntry(activity);
  const edited = isEditedEntry(activity);
  // 内訳は2種類以上あるときだけ。1行しかないなら学習時間と同じことを2回言うことになる
  const breakdown = displaySegments(session.segments ?? [], session.durationMinutes);

  const meta = [
    // 手動記録に「21:05」と出すと計測したように見えるので、時刻は出さない
    manual ? null : timeOnly ? formatTime(activity.startedAt) : formatDayTime(activity.startedAt),
    breakdown.length > 0
      ? breakdown.map((s) => `${STUDY_CATEGORY_LABEL[s.category]}${formatMinutesHM(s.minutes)}`).join(' ・ ')
      : null,
    session.achievement ? ACHIEVEMENT_LABEL[session.achievement] : null,
  ]
    .filter(Boolean)
    .join(' ・ ');

  const showActions = Boolean(onEdit || onDelete);

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
          background: course ? 'var(--dc-soft-100)' : 'var(--dc-sunken)',
          color: course ? 'var(--dc-primary)' : 'var(--dc-text-subtle)',
        }}
      >
        <BookOpen size={15} strokeWidth={1.75} />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span
            style={{
              fontSize: 'var(--dc-fs-body)',
              fontWeight: 600,
              color: course ? 'var(--dc-text)' : 'var(--dc-text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {course?.courseTitle ?? '教材を指定しない'}
          </span>
          {manual && <Chip icon={<Pencil size={10} strokeWidth={2.5} />} label="手動" />}
          {edited && <Chip icon={<Pencil size={10} strokeWidth={2.5} />} label="編集済み" />}
        </div>

        {meta && (
          <div
            style={{
              fontSize: 'var(--dc-fs-caption)',
              color: 'var(--dc-text-subtle)',
              marginTop: 3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {meta}
          </div>
        )}

        {session.memo && (
          <div
            style={{
              fontSize: 'var(--dc-fs-caption)',
              color: 'var(--dc-text-body)',
              marginTop: 4,
              lineHeight: 'var(--dc-lh-ui)',
              overflowWrap: 'anywhere',
            }}
          >
            {session.memo}
          </div>
        )}
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
        {formatMinutesHM(session.durationMinutes)}
      </span>

      {showActions && (
        // ホバー／フォーカスで出す。タッチ端末では常時表示（index.css の .studylog-row-actions）
        <span className="studylog-row-actions" style={{ display: 'flex', gap: 6, flex: 'none' }}>
          {onEdit && iconButton('この記録を編集', <Pencil size={14} strokeWidth={2} />, () => onEdit(activity), busy)}
          {onDelete &&
            iconButton('この記録を削除', <Trash2 size={14} strokeWidth={2} />, () => onDelete(activity), busy, true)}
        </span>
      )}
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
