import { color, font, radius, shadow, t } from '../../theme/webcoachTheme';
import { StudyRanking } from '../../types/studyActivity';
import { formatMinutesHM } from './focusFormat';
import { EmptySessions } from './StudySessionRow';

/**
 * 週間学習時間ランキング。ユーザー表示名の解決は別途必要なため、現時点ではユーザーIDで表示する。
 */
interface RankingCardProps {
  ranking: StudyRanking | null;
  currentUserId?: number;
  loading: boolean;
}

export function RankingCard({ ranking, currentUserId, loading }: RankingCardProps) {
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
      <h2 style={{ ...font.cardTitle, color: color.text, margin: 0 }}>今週のランキング</h2>

      {loading ? (
        <div style={{ ...font.caption, color: color.textSubtle }}>読み込んでいます…</div>
      ) : !ranking || ranking.entries.length === 0 ? (
        <EmptySessions message="まだランキングはありません。学習を記録すると表示されます。" />
      ) : (
        <div className="flex flex-col" style={{ gap: 8 }}>
          {ranking.entries.map((entry) => (
            <div
              key={entry.userid}
              style={{
                ...t.listRow,
                background: entry.userid === currentUserId ? color.primarySoft : undefined,
              }}
            >
              <span
                style={{
                  ...font.rowTitle,
                  width: 24,
                  flexShrink: 0,
                  textAlign: 'center',
                  color: entry.rank <= 3 ? color.primary : color.textMuted,
                }}
              >
                {entry.rank}
              </span>
              <span style={{ ...font.rowTitle, flex: 1, color: color.text }}>
                ユーザーID {entry.userid}
                {entry.userid === currentUserId ? '(あなた)' : ''}
              </span>
              <span style={{ ...font.rowTitle, color: color.textSecondary, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {formatMinutesHM(entry.total_minutes)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default RankingCard;
