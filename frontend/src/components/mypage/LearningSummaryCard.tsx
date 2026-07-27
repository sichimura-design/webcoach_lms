import { Clock, BookOpen, Flame, Check } from 'lucide-react';
import { Badge, WeekActivity } from '../../types/mypage';
import RecentBadgesRow from './RecentBadgesRow';

interface SummaryValue {
  total: number;
  weekDelta: number | null;
}

interface LearningSummaryCardProps {
  studyMinutes: SummaryValue;
  completedLessons: SummaryValue;
  thisWeekMinutes: number;
  weeklyTargetMinutes: number;
  streakDays: number;
  streakBest?: number;
  weekActivity: WeekActivity[];
  badges: Badge[];
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}分`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}時間` : `${h}時間${m}分`;
}

function StatTile({ icon, label, value, deltaLabel }: { icon: React.ReactNode; label: string; value: React.ReactNode; deltaLabel?: string }) {
  return (
    <div className="bg-white flex items-center" style={{ borderRadius: 20, boxShadow: '0 8px 26px rgba(190,60,70,.08)', padding: '20px 24px', gap: 16 }}>
      <span className="flex items-center justify-center flex-shrink-0" style={{ width: 46, height: 46, borderRadius: 13, background: '#FCE7E7', color: '#E0213A' }}>
        {icon}
      </span>
      <div>
        <div style={{ fontSize: 12, color: '#9A8B8D', fontWeight: 700 }}>{label}</div>
        <div className="flex items-baseline gap-2" style={{ marginTop: 2 }}>
          <span style={{ fontSize: 22, fontWeight: 900, color: '#2A2230' }}>{value}</span>
          {deltaLabel && <span style={{ fontSize: 12, fontWeight: 700, color: '#E0213A' }}>{deltaLabel}</span>}
        </div>
      </div>
    </div>
  );
}

function LearningSummaryCard({
  studyMinutes, completedLessons, thisWeekMinutes, weeklyTargetMinutes,
  streakDays, streakBest, weekActivity, badges,
}: LearningSummaryCardProps) {
  const weeklyPercent = weeklyTargetMinutes > 0 ? Math.min(100, Math.round((thisWeekMinutes / weeklyTargetMinutes) * 100)) : 0;
  const isSelfBest = streakBest === undefined || streakDays >= streakBest;

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 20 }}>
        <StatTile
          icon={<Clock className="w-5 h-5" />}
          label="総学習時間"
          value={formatMinutes(studyMinutes.total)}
          deltaLabel={studyMinutes.weekDelta !== null ? `${studyMinutes.weekDelta >= 0 ? '+' : ''}${studyMinutes.weekDelta}分 先週比` : undefined}
        />
        <StatTile
          icon={<BookOpen className="w-5 h-5" />}
          label="完了レッスン"
          value={`${completedLessons.total}件`}
          deltaLabel={completedLessons.weekDelta !== null ? `${completedLessons.weekDelta >= 0 ? '+' : ''}${completedLessons.weekDelta}件 先週比` : undefined}
        />
      </div>

      <div
        className="bg-white flex flex-col"
        style={{ borderRadius: 20, boxShadow: '0 8px 26px rgba(190,60,70,.08)', padding: '20px 24px', gap: 18 }}
      >
        <div>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#9A8B8D' }}>今週の学習時間</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#E0213A' }}>目標{formatMinutes(weeklyTargetMinutes)}・{weeklyPercent}%</span>
          </div>
          <div className="flex items-baseline gap-2" style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#2A2230' }}>{formatMinutes(thisWeekMinutes)}</span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 8, background: '#F1E3E3' }}>
            <div className="h-full rounded-full" style={{ width: `${weeklyPercent}%`, background: 'linear-gradient(90deg,#F0546A,#E0213A)' }} />
          </div>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3" style={{ borderTop: '1px solid #F3E6E6', paddingTop: 16 }}>
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4" style={{ color: '#E0213A' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#2A2230' }}>{streakDays}日連続</span>
            <span style={{ fontSize: 12, color: isSelfBest ? '#E0213A' : '#9A8B8D', fontWeight: 700 }}>
              {isSelfBest ? '自己ベスト更新中!🔥' : `自己ベスト ${streakBest}日`}
            </span>
          </div>
        </div>

        <div className="flex justify-between">
          {weekActivity.map((d, i) => (
            <div key={i} className="flex flex-col items-center" style={{ gap: 6 }}>
              <span style={{ fontSize: 11, color: '#9A8B8D' }}>{d.label}</span>
              {d.studied ? (
                <span className="flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: '50%', background: '#E0213A' }}>
                  <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                </span>
              ) : (
                <span style={{ width: 26, height: 26, borderRadius: '50%', border: '2px dashed #EBD3D4' }} />
              )}
            </div>
          ))}
        </div>

        <RecentBadgesRow badges={badges} />
      </div>
    </div>
  );
}

export default LearningSummaryCard;
