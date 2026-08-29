/**
 * 統計タイル用のアイコン。mypage/StatsCard.tsxと同じ書式のインラインSVG。
 */
import { color } from '../../theme/webcoachTheme';

interface IconProps {
  size?: number;
  stroke?: string;
}

function base(size: number, stroke: string) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

/** 今日の学習時間 */
export function ClockIcon({ size = 28, stroke = color.primary }: IconProps) {
  return (
    <svg {...base(size, stroke)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5l3.5 2" />
    </svg>
  );
}

/** 今週の学習時間 */
export function CalendarIcon({ size = 26, stroke = color.textBody }: IconProps) {
  return (
    <svg {...base(size, stroke)}>
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
    </svg>
  );
}

/** ストリーク(炎) */
export function FlameIcon({ size = 26, stroke = color.primary }: IconProps) {
  return (
    <svg {...base(size, stroke)}>
      <path d="M12 3.5s4.5 3.6 4.5 8a4.5 4.5 0 0 1-9 0c0-1.6.7-2.9 1.5-3.9" />
      <path d="M12 20.5a3 3 0 0 0 3-3c0-1.9-3-4.2-3-4.2s-3 2.3-3 4.2a3 3 0 0 0 3 3z" />
    </svg>
  );
}

/** 累計の学習時間 */
export function StackIcon({ size = 26, stroke = color.textBody }: IconProps) {
  return (
    <svg {...base(size, stroke)}>
      <path d="M4 8.5 12 4.5l8 4-8 4-8-4z" />
      <path d="M4 12.5l8 4 8-4M4 16.5l8 4 8-4" />
    </svg>
  );
}
