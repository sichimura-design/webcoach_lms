import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { StudyStats, StudyStreak } from '../../types/studyActivity';
import { formatMinutesHM } from './focusFormat';
import { CalendarIcon, ClockIcon, FlameIcon, StackIcon } from './statIcons';

/**
 * 集中ブース右側の学習時間サマリー(今日/今週/ストリーク/累計)。
 */
interface StudyStatsCardProps {
  stats: StudyStats | null;
  streak: StudyStreak | null;
  loading: boolean;
}

function Cell({
  index,
  icon,
  label,
  value,
  accent,
}: {
  index: number;
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 13,
        padding: '15px 6px 15px 16px',
        borderLeft: index % 2 === 1 ? `1px solid ${color.divider}` : undefined,
        borderTop: index >= 2 ? `1px solid ${color.divider}` : undefined,
        minWidth: 0,
      }}
    >
      <span style={{ flexShrink: 0, display: 'grid', placeItems: 'center' }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...font.label, color: color.textSubtle }}>{label}</div>
        <div
          style={{
            ...font.statValue,
            color: accent ? color.primary : color.text,
            marginTop: 4,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

export function StudyStatsCard({ stats, streak, loading }: StudyStatsCardProps) {
  const dash = loading ? '…' : '—';
  const hm = (m: number | undefined) => (m === undefined ? dash : formatMinutesHM(m));

  return (
    <div
      style={{
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.card,
        boxShadow: shadow.card,
        padding: '6px 12px 14px',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
        <Cell index={0} icon={<ClockIcon />} label="今日の学習時間" value={hm(stats?.today_minutes)} />
        <Cell index={1} icon={<CalendarIcon />} label="今週の学習時間" value={hm(stats?.week_minutes)} />
        <Cell
          index={2}
          icon={<FlameIcon />}
          label="学習ストリーク"
          value={streak === null ? dash : `${streak.current_streak}日`}
          accent
        />
        <Cell index={3} icon={<StackIcon />} label="累計の学習時間" value={hm(stats?.total_minutes)} />
      </div>
    </div>
  );
}

export default StudyStatsCard;
