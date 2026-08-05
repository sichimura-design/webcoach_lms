import { useNavigate } from 'react-router-dom';
import { Timer } from 'lucide-react';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { StudyStatsSummary } from '../../types/studyActivity';
import { formatMinutesHM } from '../../utils/studyStats';
import { nextStreakMilestone, streakMessage } from '../../utils/streakMilestones';

/**
 * 学習日数（ストリーク）の小カード。右レールに置く。
 *
 * 以前はグラデーションの大きなヒーローだったが、
 * 画面内で主役が2つ以上になって全体がうるさくなったため小さくした。
 * 代わりに「次の節目まであと何日」を出して、続ける動機は残している。
 *
 * 🔴 日数はログイン日数ではなく「実際に学習した日数」。
 *    集計は utils/studyStats.ts の computeStreak が唯一の実装で、
 *    集中ブース・学習ログ・ここが同じ値を見る。
 *    節目のしきい値も utils/streakMilestones.ts の STREAK_MILESTONES が単一の正。
 */
interface StreakMiniCardProps {
  stats: StudyStatsSummary | null;
  loading: boolean;
}

export function StreakMiniCard({ stats, loading }: StreakMiniCardProps) {
  const navigate = useNavigate();
  const streak = stats?.streak;
  const current = streak?.currentDays ?? 0;
  const next = nextStreakMilestone(current);
  const percent = next ? Math.min(100, Math.round((current / next) * 100)) : 100;

  // 今日ぶんが未成立なら、あと何分で成立するかを出す。
  // この情報の置き場はここ1箇所（以前は集中ブース導線カードにも出ていた）。
  const shortfall =
    streak && !streak.todayAchieved
      ? Math.max(0, streak.thresholdMinutes - streak.todayMinutes)
      : 0;

  return (
    <section
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
      <h2 style={{ ...font.cardTitle, color: color.text, margin: 0 }}>学習日数</h2>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 20, lineHeight: 1 }}>🔥</span>
        <span
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: color.primary,
            lineHeight: 1.05,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {loading ? '…' : current}
        </span>
        <span style={{ ...font.bodyLarge, color: color.primary }}>日連続</span>
      </div>

      <div style={{ ...font.caption, color: color.textSubtle, lineHeight: 1.8 }}>
        {loading ? '　' : streakMessage(current, !!streak?.todayAchieved)}
      </div>

      {/* 次の節目に対する現在地 */}
      {next && (
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              ...font.caption,
              color: color.textFaint,
              marginBottom: 6,
            }}
          >
            <span>0日</span>
            <span>{next}日</span>
          </div>
          <div
            style={{
              height: 8,
              borderRadius: radius.pill,
              background: color.trackBg,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${percent}%`,
                height: '100%',
                background: color.primary,
                borderRadius: radius.pill,
                transition: 'width 400ms ease',
              }}
            />
          </div>
          <div
            style={{
              ...font.caption,
              color: color.textSubtle,
              marginTop: 6,
              textAlign: 'center',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {current} / {next}
          </div>

          <div
            style={{
              marginTop: 10,
              background: color.primarySoft,
              color: color.primary,
              borderRadius: radius.pill,
              padding: '8px 14px',
              textAlign: 'center',
              ...font.chip,
            }}
          >
            {next}日連続まで あと{next - current}日
          </div>
        </div>
      )}

      {!loading && shortfall > 0 && (
        <div style={{ ...font.caption, color: color.textBody, lineHeight: 1.8 }}>
          今日はあと {formatMinutesHM(shortfall)} で「学習した日」になります。
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate('/focus-booth')}
        className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          background: 'transparent',
          border: 'none',
          padding: '4px 0 0',
          fontFamily: 'inherit',
          ...font.link,
          color: color.primary,
          cursor: 'pointer',
        }}
      >
        <Timer size={14} />
        集中ブースで記録する →
      </button>
    </section>
  );
}

export default StreakMiniCard;
