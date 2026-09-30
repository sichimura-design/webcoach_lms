import { ArrowRight } from 'lucide-react';
import { color, font, radius, shadow, t } from '../../theme/webcoachTheme';
import { StudySession } from '../../types/studyActivity';
import StudySessionRow, { EmptySessions } from './StudySessionRow';

interface RecentSessionsCardProps {
  sessions: StudySession[];
  loading: boolean;
  onSeeAll?: () => void;
}

export function RecentSessionsCard({ sessions, loading, onSeeAll }: RecentSessionsCardProps) {
  return (
    <div
      className="flex flex-col"
      style={{
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.card,
        boxShadow: shadow.card,
        padding: '20px 22px 18px',
        gap: 14,
      }}
    >
      <h2 style={{ ...font.cardTitle, color: color.text, margin: 0 }}>最近の学習記録</h2>

      {loading ? (
        <div style={{ ...font.caption, color: color.textSubtle }}>読み込んでいます…</div>
      ) : sessions.length === 0 ? (
        <EmptySessions />
      ) : (
        <div className="flex flex-col" style={{ gap: 10 }}>
          {sessions.map((s, i) => (
            <StudySessionRow key={`${s.started_at}-${i}`} session={s} />
          ))}
        </div>
      )}

      {onSeeAll && (
        <button
          type="button"
          onClick={onSeeAll}
          className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{ ...t.ghostButton, cursor: 'pointer', justifyContent: 'center', gap: 8 }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = color.hoverBgTint;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = color.surface;
          }}
        >
          学習履歴をすべて見る
          <ArrowRight size={15} color={color.textMuted} />
        </button>
      )}
    </div>
  );
}

export default RecentSessionsCard;
