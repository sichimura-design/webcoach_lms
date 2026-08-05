import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { StudyDayTotal } from '../../types/studyActivity';
import { formatMinutesHM } from '../../utils/studyStats';
import { formatShortDate } from '../focus/focusFormat';

/**
 * 日別の学習時間。
 *
 * 🔴 ResponsiveContainer は使わず幅・高さをリテラルで渡す。
 *    このページは固定1440pxレイアウト（transform:scale で縮小）なので幅は計算済みで、
 *    ResponsiveContainer は親の実測に依存するため scale 下や初回レンダで高さ0になる。
 *
 * 1系列＝1色（color.primary）。グリッドは横線のみ。0分の日はバーが出ない
 * （学習していない日が見えるので、それが意図どおり）。
 */
interface DailyStudyChartProps {
  daily: StudyDayTotal[];
  width: number;
  height?: number;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.md,
        boxShadow: shadow.card,
        padding: '9px 12px',
      }}
    >
      <div style={{ ...font.caption, color: color.textSubtle }}>{label}</div>
      <div style={{ ...font.rowTitle, color: color.text, marginTop: 3 }}>
        {formatMinutesHM(payload[0].value)}
      </div>
    </div>
  );
}

export function DailyStudyChart({ daily, width, height = 240 }: DailyStudyChartProps) {
  const data = daily.map((d) => ({ label: formatShortDate(d.date), minutes: d.minutes }));

  if (data.length === 0) {
    return (
      <div
        style={{
          height,
          display: 'grid',
          placeItems: 'center',
          ...font.caption,
          color: color.textSubtle,
        }}
      >
        まだ学習記録がありません。
      </div>
    );
  }

  return (
    <BarChart
      width={width}
      height={height}
      data={data}
      margin={{ top: 4, right: 8, bottom: 0, left: -18 }}
    >
      <CartesianGrid vertical={false} stroke={color.divider} />
      <XAxis
        dataKey="label"
        tickLine={false}
        axisLine={false}
        interval="preserveStartEnd"
        tick={{ fill: color.textSubtle, fontSize: 11.5 }}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        width={54}
        unit="分"
        tick={{ fill: color.textSubtle, fontSize: 11.5 }}
      />
      <Tooltip cursor={{ fill: color.hoverBg }} content={<ChartTooltip />} />
      <Bar dataKey="minutes" fill={color.primary} radius={[6, 6, 0, 0]} maxBarSize={18} />
    </BarChart>
  );
}

export default DailyStudyChart;
