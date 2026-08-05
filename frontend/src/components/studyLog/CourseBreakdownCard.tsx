import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { CourseStudyTotal } from '../../types/studyActivity';
import { formatMinutesHM } from '../../utils/studyStats';

/**
 * 教材別の学習時間。
 *
 * バーは「総学習時間に対するその教材の割合」なのでラベルは「割合」。
 * 学習効果を数値化した指標ではない（docs/design-token-spec.md の禁止事項に触れないよう、
 * 「理解」「習得」「達成率」といった語は使わない）。
 */
interface CourseBreakdownCardProps {
  byCourse: CourseStudyTotal[];
  loading: boolean;
}

export function CourseBreakdownCard({ byCourse, loading }: CourseBreakdownCardProps) {
  const total = byCourse.reduce((sum, c) => sum + c.minutes, 0);

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
      <h2 style={{ ...font.cardTitle, color: color.text, margin: 0 }}>教材別の学習時間</h2>

      {loading ? (
        <div style={{ ...font.caption, color: color.textSubtle }}>読み込んでいます…</div>
      ) : byCourse.length === 0 ? (
        <div style={{ ...font.caption, color: color.textSubtle }}>まだ記録がありません。</div>
      ) : (
        <div className="flex flex-col" style={{ gap: 14 }}>
          {byCourse.map((c) => {
            const share = total > 0 ? Math.round((c.minutes / total) * 100) : 0;
            const isNone = c.courseId === null;
            return (
              <div key={String(c.courseId)}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginBottom: 7,
                  }}
                >
                  <span
                    style={{
                      ...font.rowTitle,
                      color: isNone ? color.textMuted : color.text,
                      minWidth: 0,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {c.courseTitle}
                  </span>
                  <span
                    style={{
                      ...font.meta,
                      color: color.textSecondary,
                      flexShrink: 0,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatMinutesHM(c.minutes)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: radius.pill,
                      background: color.trackBg,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${share}%`,
                        height: '100%',
                        background: isNone ? color.primaryDashed : color.primary,
                        borderRadius: radius.pill,
                        transition: 'width 400ms ease',
                      }}
                    />
                  </div>
                  <span style={{ ...font.link, color: color.textSubtle, flexShrink: 0 }}>
                    割合 {share}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CourseBreakdownCard;
