import { useNavigate } from 'react-router-dom';
import { Timer } from 'lucide-react';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { StudyStatsSummary } from '../../types/studyActivity';
import { formatMinutesHM } from '../../utils/studyStats';
import { streakMessage } from '../../utils/streakMilestones';

/**
 * 学習日数（ストリーク）の小カード。右レールに置く。
 *
 * 出すのは「いま何日続いているか」だけ。
 * 🔴 次の節目までのゲージ／残り日数カウントは置かない。
 *    「7日まであと2日」は達成の後押しよりも未達の指摘に読めてしまう、
 *    というレビュー指摘で削除された。復活させる場合は表現から作り直すこと。
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

      {/*
        続いている日数がこのカードの主役。
        🔴 以前は 0日〜N日のゲージ・「N/M」・「あとX日」チップを重ねていたが、
           次の節目までのカウントダウンが「まだ足りない」と読めてしまうため、
           レビューで削除された。いま何日続いているかだけを大きく出す。
      */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '2px 0 0' }}>
        <span style={{ fontSize: 34, lineHeight: 1 }}>🔥</span>
        <span
          style={{
            fontSize: 52,
            fontWeight: 900,
            color: color.primary,
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {loading ? '…' : current}
        </span>
        <span style={{ fontSize: 24, fontWeight: 900, color: color.primary, letterSpacing: '0.01em' }}>
          日連続
        </span>
      </div>

      <div style={{ ...font.caption, color: color.textSubtle, lineHeight: 1.8 }}>
        {loading ? '　' : streakMessage(current, !!streak?.todayAchieved)}
      </div>

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
          background: color.surface,
          border: `1px solid ${color.primaryBorder}`,
          borderRadius: radius.pill,
          padding: '11px 14px',
          marginTop: 2,
          fontFamily: 'inherit',
          ...font.buttonSm,
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
