/**
 * 学習記録ページの「コーチング記録」。
 *
 * コーチング記録はここにためる。/coaching に残すのは前回分だけで、
 * 過去を辿るのはこの一覧から。1行1回、日付と一言要約だけに絞る。
 *
 * 🔴 見た目は /study-log の他のカードに合わせて --dc-* トークンで組む。
 *    coaching/design1c.ts（1Cの暖色クリーム）はあちら専用なので持ち込まない。
 */
import { formatSessionDate } from '../../utils/coachingSchedule';
import type { CoachingSessionSummary } from '../../types/coaching';

interface CoachingRecordsCardProps {
  sessions: CoachingSessionSummary[];
  loading: boolean;
  onOpen: (sessionId: number) => void;
}

export function CoachingRecordsCard({ sessions, loading, onOpen }: CoachingRecordsCardProps) {
  return (
    <section
      style={{
        background: 'var(--dc-surface)',
        border: '1px solid var(--dc-border)',
        borderRadius: 'var(--dc-radius-lg)',
        boxShadow: 'var(--dc-shadow-card)',
        padding: 'var(--dc-sp-card-y) var(--dc-sp-card-x)',
      }}
    >
      <h2 style={{ margin: 0, fontSize: 'var(--dc-fs-lead)', fontWeight: 700, color: 'var(--dc-text)' }}>
        コーチング記録
        {sessions.length > 0 && (
          <span className="dc-num" style={{ fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-subtle)', marginLeft: 10 }}>
            {sessions.length}件
          </span>
        )}
      </h2>

      {loading ? (
        <p style={{ margin: '14px 0 0', fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-muted)' }}>読み込み中…</p>
      ) : sessions.length === 0 ? (
        <p style={{ margin: '14px 0 0', fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-muted)', lineHeight: 'var(--dc-lh-prose)' }}>
          まだ記録がありません。コーチングが終わると、話した内容と決めたことがここに残ります。
        </p>
      ) : (
        <div style={{ marginTop: 6 }}>
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onOpen(s.id)}
              className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                minHeight: 44,
                padding: '10px 0',
                borderTop: '1px solid var(--dc-border)',
                borderLeft: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                background: 'transparent',
                fontFamily: 'inherit',
                fontSize: 'var(--dc-fs-body)',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              {/* 日付の幅を固定して縦に揃える。折り返させると積み上がりが読めなくなる */}
              <span style={{ fontWeight: 700, width: 200, flex: 'none', color: 'var(--dc-text)', whiteSpace: 'nowrap' }}>
                {formatSessionDate(s.date)}
                <span style={{ fontWeight: 400, color: 'var(--dc-text-muted)', marginLeft: 8 }}>{s.title}</span>
              </span>
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  color: 'var(--dc-text-muted)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {s.summary}
              </span>
              <span style={{ color: 'var(--dc-primary)', fontWeight: 700, flex: 'none' }}>詳しく見る ›</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default CoachingRecordsCard;
