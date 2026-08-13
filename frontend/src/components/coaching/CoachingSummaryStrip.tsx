import { color, font, t } from '../../theme/webcoachTheme';
import type { NextCoaching } from '../../types/coaching';

/**
 * コーチングページの先頭に置くサマリー帯。
 *
 * 「このページって何をするためにあるのというのが伝わらず、ただ機械的に触られるだけ」
 * という指摘への対応。最初の1画面で「次はいつ・あと何日・いまどこまで」の3つを答え、
 * 学習者が自分の現在地を掴んでから下の操作に入れるようにする。
 */
interface CoachingSummaryStripProps {
  next: NextCoaching | null;
  doneCount: number;
  totalCount: number;
}

function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color.primary} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color.primary} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5l3.5 2" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color.primary} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 16.5 9 10.5l3.5 3.5L20.5 6" />
      <path d="M15.5 6h5v5" />
    </svg>
  );
}

/**
 * 残り日数。startsAt が無ければ null を返して、そのセルごと出さない。
 * 表示用の日付文字列（「8月10日(月) 10:00〜11:00」）から日数を起こすと、
 * 年をまたいだ瞬間に嘘の数字が出るため、機械可読な値が無いときは出さないほうが正しい。
 */
function daysUntil(startsAt: string | null): number | null {
  if (!startsAt) return null;
  const target = new Date(startsAt);
  if (Number.isNaN(target.getTime())) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = startOfDay(target) - startOfDay(new Date());
  return Math.round(diff / 86_400_000);
}

function Cell({
  icon,
  label,
  value,
  first,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  first?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
      {!first && <span style={{ width: 1, height: 44, background: color.divider, flexShrink: 0, marginRight: 6 }} />}
      <span style={{ flexShrink: 0, display: 'flex' }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...font.caption, color: color.textMuted }}>{label}</div>
        <div style={{ ...font.cardTitleLg, color: color.text, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </div>
      </div>
    </div>
  );
}

export function CoachingSummaryStrip({ next, doneCount, totalCount }: CoachingSummaryStripProps) {
  const days = daysUntil(next?.startsAt ?? null);

  const cells: { key: string; icon: React.ReactNode; label: string; value: string }[] = [
    { key: 'next', icon: <CalendarIcon />, label: '次回', value: next?.date ?? '未定' },
  ];

  if (days !== null) {
    cells.push({
      key: 'countdown',
      icon: <ClockIcon />,
      label: '次回まであと',
      // 当日・過ぎている場合に「あと-2日」を出さない
      value: days > 0 ? `${days}日` : days === 0 ? '今日' : '調整中',
    });
  }

  cells.push({
    key: 'progress',
    icon: <TrendIcon />,
    label: '目標の達成',
    value: totalCount > 0 ? `${doneCount} / ${totalCount}` : '—',
  });

  return (
    <section
      style={{
        ...t.card,
        padding: '20px 28px',
        display: 'grid',
        gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))`,
        gap: 16,
        alignItems: 'center',
      }}
    >
      {cells.map((c, i) => (
        <Cell key={c.key} icon={c.icon} label={c.label} value={c.value} first={i === 0} />
      ))}
    </section>
  );
}

export default CoachingSummaryStrip;
