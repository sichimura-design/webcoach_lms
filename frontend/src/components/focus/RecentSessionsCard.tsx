import { color, font, radius, shadow, t } from '../../theme/webcoachTheme';
import { StudyActivity } from '../../types/studyActivity';
import { ArrowRightIcon } from '../mypage/ContinueLearningHero';
import StudySessionRow, { EmptySessions } from './StudySessionRow';

/**
 * 集中ブース右下「最近の学習記録」。詳しい集計は /study-log に置く。
 */
interface RecentSessionsCardProps {
  activities: StudyActivity[];
  loading: boolean;
  onSeeAll: () => void;
}

export function RecentSessionsCard({ activities, loading, onSeeAll }: RecentSessionsCardProps) {
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
      ) : activities.length === 0 ? (
        <EmptySessions />
      ) : (
        <div className="flex flex-col" style={{ gap: 10 }}>
          {activities.map((a) => (
            <StudySessionRow key={a.id} activity={a} />
          ))}
        </div>
      )}

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
        <ArrowRightIcon size={15} stroke={color.textMuted} />
      </button>
    </div>
  );
}

export default RecentSessionsCard;
