import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { StudyStatsSummary } from '../../types/studyActivity';
import { formatMinutesHM } from '../../utils/studyStats';
import {
  CalendarIcon,
  ClockIcon,
  FlameIcon,
  MonthIcon,
  PeakIcon,
  StackIcon,
} from './statIcons';

/**
 * 集中ブース右中央の学習時間サマリー。
 *
 * mypage/StatsStrip.tsx の視覚言語（アイコン＋ラベル12/500/textSubtle＋数値22/900）を
 * 持ち込むが、幅が狭いので横1列ではなく2×2グリッドにする。
 * StatsStrip の縦罫（width:1 の div）はグリッドでは使えないので、
 * セルの borderTop / borderLeft に divider を回して同じ見え方にする。
 */
interface StudyStatsCardProps {
  stats: StudyStatsSummary | null;
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

export function StudyStatsCard({ stats, loading }: StudyStatsCardProps) {
  const today = stats?.today;
  const week = stats?.week;
  const month = stats?.month;
  const streak = stats?.streak;

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
        <Cell index={0} icon={<ClockIcon />} label="今日の学習時間" value={hm(today?.minutes)} />
        <Cell index={1} icon={<CalendarIcon />} label="今週の学習時間" value={hm(week?.minutes)} />
        <Cell
          index={2}
          icon={<FlameIcon />}
          label="現在のストリーク"
          value={streak === undefined ? dash : `${streak.currentDays}日`}
          accent
        />
        <Cell
          index={3}
          icon={<StackIcon />}
          label="今日のセッション数"
          value={today === undefined ? dash : `${today.sessionCount}回`}
        />
      </div>

      {/* 副指標。要件の「今月の学習時間」「最長集中時間」 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          borderTop: `1px solid ${color.divider}`,
          marginTop: 4,
          paddingTop: 12,
        }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, paddingLeft: 16 }}>
          <MonthIcon />
          <span style={{ ...font.caption, color: color.textSubtle }}>今月</span>
          <span style={{ ...font.rowTitle, color: color.textBody }}>{hm(month?.minutes)}</span>
        </div>
        <div style={{ width: 1, height: 20, background: color.divider }} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 9, paddingLeft: 16 }}>
          <PeakIcon />
          <span style={{ ...font.caption, color: color.textSubtle }}>最長集中</span>
          <span style={{ ...font.rowTitle, color: color.textBody }}>
            {hm(stats?.allTime.longestMinutes)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default StudyStatsCard;
