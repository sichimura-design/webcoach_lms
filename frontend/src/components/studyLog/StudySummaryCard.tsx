import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { StudyStatsSummary } from '../../types/studyActivity';
import { formatMinutesHM, STUDY_DAY_MIN_MINUTES } from '../../utils/studyStats';
import { CalendarIcon, ClockIcon, FlameIcon, PeakIcon } from '../focus/statIcons';
import WeekStudyStrip from './WeekStudyStrip';

interface StudySummaryCardProps {
  stats: StudyStatsSummary | null;
  loading: boolean;
  /** 期間ピルの選択に追随するラベル（「直近30日」など） */
  rangeLabel: string;
  rangeMinutes: number;
  studiedDays: number;
}

/**
 * 学習記録のサマリー。
 *
 * 以前は「累計カード（5行）＋日別の棒グラフ＋教材別の内訳」の3面構成で、
 * 「色々書いてありすぎる」という指摘を受けた。数字を4つに絞り、
 * 主役（期間の学習時間）だけを特大にして残りは同じ大きさで横に並べる。
 * 縦罫の区切りは mypage/StatsStrip.tsx と同じ作法。
 */
export function StudySummaryCard({
  stats,
  loading,
  rangeLabel,
  rangeMinutes,
  studiedDays,
}: StudySummaryCardProps) {
  const dash = loading ? '…' : '—';
  const v = (ready: boolean, value: string) => (loading || !ready ? dash : value);

  const cells = [
    {
      key: 'days',
      icon: <CalendarIcon size={22} />,
      label: '学習した日数',
      value: v(!!stats, `${studiedDays}日`),
    },
    {
      key: 'week',
      icon: <PeakIcon size={22} stroke={color.textBody} />,
      label: '今週の学習時間',
      value: v(!!stats, formatMinutesHM(stats?.week.minutes ?? 0)),
    },
    {
      key: 'streak',
      icon: <FlameIcon size={22} />,
      label: '現在の連続日数',
      value: v(!!stats, `${stats?.streak.currentDays ?? 0}日`),
    },
  ];

  return (
    <div
      style={{
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.card,
        boxShadow: shadow.card,
        padding: '26px 30px 22px',
      }}
    >
      <div className="studylog-summary-row">
        {/* 主役。この画面で最初に読ませたい1つなので、他のセルの倍の大きさにする */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, minWidth: 0 }}>
          <span
            style={{
              width: 62,
              height: 62,
              borderRadius: '50%',
              background: color.primarySoft,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ClockIcon size={30} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...font.meta, color: color.textMuted }}>{rangeLabel}の学習時間</div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 900,
                letterSpacing: '.2px',
                color: color.text,
                fontVariantNumeric: 'tabular-nums',
                marginTop: 4,
              }}
            >
              {v(!!stats, formatMinutesHM(rangeMinutes))}
            </div>
          </div>
        </div>

        {cells.map((c) => (
          <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <span style={{ width: 1, height: 56, background: color.divider, flexShrink: 0 }} />
            <span style={{ flexShrink: 0, display: 'flex' }}>{c.icon}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{ ...font.caption, color: color.textMuted }}>{c.label}</div>
              <div
                style={{
                  ...font.statValue,
                  color: color.text,
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: 4,
                }}
              >
                {c.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ height: 1, background: color.divider, margin: '22px 0 18px' }} />

      <WeekStudyStrip
        daily={stats?.dailyTotals ?? []}
        thresholdMinutes={stats?.streak.thresholdMinutes ?? STUDY_DAY_MIN_MINUTES}
      />
    </div>
  );
}

export default StudySummaryCard;
