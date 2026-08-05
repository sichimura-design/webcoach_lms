import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { StudyStatsSummary } from '../../types/studyActivity';
import { formatMinutesHM } from '../../utils/studyStats';

/**
 * 累計サマリー。集中ブース側は「今日／今週」に絞っているので、
 * 総量はこちらでまとめて見せる。
 */
interface TotalsCardProps {
  stats: StudyStatsSummary | null;
  loading: boolean;
  /** 表示している期間のラベル（「直近30日」など） */
  rangeLabel: string;
  /** 表示している期間の集計 */
  rangeMinutes: number;
  rangeSessions: number;
  studiedDays: number;
}

function Line({ label, value, first }: { label: string; value: string; first?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '13px 0',
        borderTop: first ? undefined : `1px solid ${color.divider}`,
      }}
    >
      <span style={{ ...font.label, color: color.textSubtle }}>{label}</span>
      <span
        style={{
          ...font.statValue,
          color: color.text,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function TotalsCard({
  stats,
  loading,
  rangeLabel,
  rangeMinutes,
  rangeSessions,
  studiedDays,
}: TotalsCardProps) {
  const dash = loading ? '…' : '—';
  const avg = rangeSessions > 0 ? Math.round(rangeMinutes / rangeSessions) : 0;

  return (
    <div
      style={{
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.card,
        boxShadow: shadow.card,
        padding: '20px 22px 14px',
      }}
    >
      <h2 style={{ ...font.cardTitle, color: color.text, margin: '0 0 6px' }}>{rangeLabel}の合計</h2>

      <Line label="学習時間" value={loading ? dash : formatMinutesHM(rangeMinutes)} first />
      <Line label="セッション数" value={loading ? dash : `${rangeSessions}回`} />
      <Line label="1回あたり平均" value={loading ? dash : formatMinutesHM(avg)} />
      <Line label="学習した日数" value={loading ? dash : `${studiedDays}日`} />

      <div
        style={{
          borderTop: `1px solid ${color.divider}`,
          marginTop: 4,
          paddingTop: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <span style={{ ...font.caption, color: color.textSubtle }}>これまでの累計</span>
        <span style={{ ...font.rowTitle, color: color.textBody }}>
          {stats ? formatMinutesHM(stats.allTime.minutes) : dash}
        </span>
      </div>
    </div>
  );
}

export default TotalsCard;
