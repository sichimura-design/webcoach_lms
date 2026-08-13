import { useMemo } from 'react';
import { color, font } from '../../theme/webcoachTheme';
import { StudyDayTotal } from '../../types/studyActivity';
import { toLocalDateKey, weekStartOf } from '../../utils/studyStats';

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

type DayState = 'studied' | 'missed' | 'future';

interface WeekStudyStripProps {
  /** 直近 N 日ぶんの日別合計。欠損日も 0 で埋まっている前提（StudyStatsSummary の契約） */
  daily: StudyDayTotal[];
  /** 「学習した日」の閾値（分）。凡例に出す */
  thresholdMinutes: number;
}

/**
 * 今週の学習状況（月〜日のドット）。
 *
 * 専用のAPIは無いので dailyTotals を今週ぶんだけ引いて作る。
 *
 * 🔴 まだ来ていない曜日を「未学習」の灰ドットにしない。
 *    水曜に見ると木金土日の4つが灰色に見え、まだ起きていない不足を先に見せることになる。
 *    未来は輪郭だけのゴーストにして、判定していないことを形で示す。
 *    （mypage/StreakMiniCard.tsx の「進捗を不足として見せない」と同じ方針）
 */
export function WeekStudyStrip({ daily, thresholdMinutes }: WeekStudyStripProps) {
  const days = useMemo(() => {
    const byDate = new Map(daily.map((d) => [d.date, d]));
    const todayKey = toLocalDateKey(new Date());
    const start = weekStartOf(new Date());

    return WEEKDAY_LABELS.map((label, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = toLocalDateKey(d);
      const hit = byDate.get(key);
      const state: DayState = key > todayKey ? 'future' : hit?.isStudyDay ? 'studied' : 'missed';
      return { key, label, state };
    });
  }, [daily]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
      <div style={{ ...font.caption, color: color.textMuted, whiteSpace: 'nowrap' }}>今週の学習状況</div>

      <div style={{ display: 'flex', gap: 26 }}>
        {days.map((d) => (
          <div key={d.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <span style={{ ...font.caption, color: color.textSubtle }}>{d.label}</span>
            <span
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                boxSizing: 'border-box',
                ...(d.state === 'studied'
                  ? { background: color.primary }
                  : d.state === 'missed'
                    ? { background: color.streakOff }
                    : { background: 'transparent', border: `1.5px solid ${color.streakOff}` }),
              }}
            />
          </div>
        ))}
      </div>

      <div style={{ ...font.caption, color: color.textSubtle }}>
        1日{thresholdMinutes}分以上で「学習した日」
      </div>
    </div>
  );
}

export default WeekStudyStrip;
