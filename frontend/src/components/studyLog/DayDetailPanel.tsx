import { MessageSquare, Plus, X } from 'lucide-react';
import { StudyActivity } from '../../types/studyActivity';
import type { CoachingSessionSummary } from '../../types/coaching';
import { STUDY_DAY_MIN_MINUTES, formatMinutesHM } from '../../utils/studyStats';
import { formatDayLabel } from '../focus/focusFormat';
import StudyLogRow, { EmptyStudyLog } from './StudyLogRow';

/**
 * カレンダーで選んだ日の中身。
 * ============================================================
 * 広い画面ではカレンダーの右横、1023px 以下ではカレンダーの真下に回り込む
 * （.studylog-calendar-grid が1カラムに落ちるだけで、DOM は同じ）。
 *
 * 🔴 モーダルにしない。カレンダーが隠れると「隣の日はどうだったか」を
 *    続けて見られなくなる。記録の編集モーダルとも階層が二重になる。
 *
 * 🔴 カレンダー直下に展開もしない。日を選ぶたびに下の推移・履歴が大きく動き、
 *    記録の無い日を選ぶと高さが急に縮む。
 * ============================================================
 */
interface DayDetailPanelProps {
  /** 選択中の日（YYYY-MM-DD）。null なら「日付を選んでください」 */
  date: string | null;
  /** その日の学習記録（新しい順） */
  activities: StudyActivity[];
  /** その日のコーチング */
  coachingSessions: CoachingSessionSummary[];
  loading: boolean;
  busy?: boolean;
  onOpenSession: (sessionId: number) => void;
  onEdit: (activity: StudyActivity) => void;
  onDelete: (activity: StudyActivity) => void;
  onAdd: (date: string) => void;
  onClose: () => void;
}

const CARD: React.CSSProperties = {
  background: 'var(--dc-surface)',
  border: '1px solid var(--dc-border)',
  borderRadius: 'var(--dc-radius-lg)',
  boxShadow: 'var(--dc-shadow-card)',
  padding: 'var(--dc-sp-card-y) var(--dc-sp-card-x)',
};

export function DayDetailPanel({
  date,
  activities,
  coachingSessions,
  loading,
  busy = false,
  onOpenSession,
  onEdit,
  onDelete,
  onAdd,
  onClose,
}: DayDetailPanelProps) {
  if (!date) {
    return (
      <section style={CARD} aria-label="選んだ日の学習内容">
        <p
          style={{
            margin: 0,
            fontSize: 'var(--dc-fs-body)',
            color: 'var(--dc-text-muted)',
            lineHeight: 'var(--dc-lh-prose)',
          }}
        >
          カレンダーの日付を選ぶと、その日に学習した教材と時間、受けたコーチングがここに出ます。
        </p>
      </section>
    );
  }

  const totalMinutes = activities.reduce((sum, a) => sum + a.session.durationMinutes, 0);
  const isStudyDay = totalMinutes >= STUDY_DAY_MIN_MINUTES;

  return (
    <section style={CARD} aria-label={`${formatDayLabel(`${date}T00:00:00`)}の学習内容`}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 4 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--dc-fs-lead)',
              fontWeight: 700,
              color: 'var(--dc-text)',
            }}
          >
            {formatDayLabel(`${date}T00:00:00`)}
          </h2>
          <p
            className="dc-num"
            style={{ margin: '4px 0 0', fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)' }}
          >
            {loading
              ? '読み込み中…'
              : activities.length === 0
                ? '学習の記録はありません'
                : `合計 ${formatMinutesHM(totalMinutes)} ・ ${activities.length}件${isStudyDay ? '' : `（${STUDY_DAY_MIN_MINUTES}分未満）`}`}
          </p>
        </div>
        <button
          type="button"
          aria-label="選択を解除する"
          onClick={onClose}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            width: 26,
            height: 26,
            flex: 'none',
            borderRadius: 9999,
            border: '1px solid var(--dc-border)',
            background: 'var(--dc-surface)',
            color: 'var(--dc-text-muted)',
            display: 'grid',
            placeItems: 'center',
            cursor: 'pointer',
          }}
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {loading ? (
          <p style={{ margin: 0, fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-subtle)' }}>
            読み込んでいます…
          </p>
        ) : activities.length === 0 ? (
          <EmptyStudyLog message="この日の学習記録はありません。記録し忘れた分は下から足せます。" />
        ) : (
          activities.map((a) => (
            <StudyLogRow key={a.id} activity={a} timeOnly onEdit={onEdit} onDelete={onDelete} busy={busy} />
          ))
        )}
      </div>

      {coachingSessions.length > 0 && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--dc-border)' }}>
          <h3
            style={{
              margin: '0 0 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 'var(--dc-fs-body)',
              fontWeight: 700,
              color: 'var(--dc-text)',
            }}
          >
            <MessageSquare size={14} strokeWidth={2} color="var(--dc-gold)" aria-hidden="true" />
            この日のコーチング
          </h3>
          {coachingSessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onOpenSession(s.id)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                minHeight: 44,
                padding: '8px 0',
                border: 'none',
                background: 'transparent',
                fontFamily: 'inherit',
                fontSize: 'var(--dc-fs-body)',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  color: 'var(--dc-text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {s.title}
              </span>
              <span style={{ color: 'var(--dc-primary)', fontWeight: 700, flex: 'none' }}>詳しく見る ›</span>
            </button>
          ))}
        </div>
      )}

      {/* 履歴カード側の「＋ 手動で記録を追加」と同じモーダルを開くショートカット。
          こちらは選んだ日が入った状態で開く（入力面は1つのまま） */}
      <button
        type="button"
        onClick={() => onAdd(date)}
        disabled={busy}
        className="dc-cta-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          width: '100%',
          marginTop: 16,
          minHeight: 40,
          borderRadius: 9999,
          border: '1px solid var(--dc-border-strong)',
          background: 'var(--dc-surface)',
          fontFamily: 'inherit',
          fontSize: 'var(--dc-fs-body)',
          fontWeight: 700,
          color: 'var(--dc-text-body)',
          cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        <Plus size={15} strokeWidth={2} aria-hidden="true" />
        この日の記録を追加
      </button>
    </section>
  );
}

export default DayDetailPanel;
