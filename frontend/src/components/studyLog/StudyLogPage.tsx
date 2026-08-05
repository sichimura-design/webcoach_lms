import { useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AppHeader } from '../shared';
import { useStudyStats } from '../../hooks/useStudyStats';
import { useStudyActivities } from '../../hooks/useStudyActivities';
import { useScaleToFit } from '../../hooks/useScaleToFit';
import { color, font, radius, shadow, space } from '../../theme/webcoachTheme';
import { toLocalDateKey } from '../../utils/studyStats';
import StudyRoomHeader from '../studyRoom/StudyRoomHeader';
import DailyStudyChart from './DailyStudyChart';
import StudyLogList from './StudyLogList';
import TotalsCard from './TotalsCard';
import CourseBreakdownCard from './CourseBreakdownCard';

const DESIGN_WIDTH = 1440;
/** .studylog-2col の左カラム幅（1440 - 60*2 - 384 - 18）からカードの内側 padding を引いた値 */
const CHART_WIDTH = 870;

type RangeKey = '30d' | '3m' | 'all';

const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: '30d', label: '直近30日', days: 30 },
  { key: '3m', label: '直近3ヶ月', days: 92 },
  { key: 'all', label: '全期間', days: 400 },
];

/**
 * 学習記録の詳細（自習室タブの2つ目）。集中ブースの「学習履歴をすべて見る」からも来る。
 * 集中ブース側を「今日・今週の要約」に保つため、累計・グラフ・全履歴はここに置く。
 */
function StudyLogPage() {
  const { user } = useAuth();
  const { outerRef, innerRef, scale, innerHeight } = useScaleToFit(DESIGN_WIDTH);

  const [range, setRange] = useState<RangeKey>('30d');
  const activeRange = RANGES.find((r) => r.key === range) ?? RANGES[0];

  const { stats, loading: statsLoading, unavailable } = useStudyStats(
    user?.userid,
    activeRange.days
  );

  // 一覧は期間で絞る。all のときは from を渡さない
  const listQuery = useMemo(() => {
    if (range === 'all') return {};
    const from = new Date();
    from.setDate(from.getDate() - (activeRange.days - 1));
    return { from: toLocalDateKey(from) };
  }, [range, activeRange.days]);

  const list = useStudyActivities(user?.userid, listQuery);

  const daily = stats?.dailyTotals ?? [];
  const rangeMinutes = daily.reduce((sum, d) => sum + d.minutes, 0);
  const rangeSessions = daily.reduce((sum, d) => sum + d.sessionCount, 0);
  const studiedDays = daily.filter((d) => d.isStudyDay).length;

  const cardStyle: React.CSSProperties = {
    background: color.surface,
    border: `1px solid ${color.border}`,
    borderRadius: radius.card,
    boxShadow: shadow.card,
    padding: '20px 24px 18px',
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: color.pageBg }}>
      <AppHeader userName={user?.username || 'User'} />

      <div className="relative flex-1">
        <div
          ref={outerRef}
          style={{
            width: '100%',
            maxWidth: DESIGN_WIDTH,
            margin: '0 auto',
            position: 'relative',
            height: innerHeight ? innerHeight * scale : undefined,
          }}
        >
          <main
            ref={innerRef}
            className="studylog-main flex flex-col"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: DESIGN_WIDTH,
              boxSizing: 'border-box',
              gap: space.sectionGap,
              fontFamily: font.family,
              color: color.text,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            <StudyRoomHeader
              active="log"
              right={
                <div style={{ display: 'flex', gap: 8 }}>
                  {RANGES.map((r) => {
                    const active = r.key === range;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => setRange(r.key)}
                        aria-pressed={active}
                        className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                        style={{
                          borderRadius: radius.pill,
                          padding: '9px 20px',
                          border: `1px solid ${active ? color.primary : color.border}`,
                          background: active ? color.primary : color.surface,
                          color: active ? color.textOnPrimary : color.textBody,
                          fontFamily: 'inherit',
                          ...font.buttonSm,
                          cursor: 'pointer',
                        }}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              }
            />

            {unavailable ? (
              <div style={{ ...cardStyle, ...font.meta, color: color.textMuted, lineHeight: 1.9 }}>
                学習記録を表示できませんでした。この機能はモック環境でのみ利用できます。
              </div>
            ) : (
              <div className="studylog-2col">
                <div className="flex flex-col" style={{ gap: space.columnGap }}>
                  <div style={cardStyle}>
                    <h2 style={{ ...font.cardTitle, color: color.text, margin: '0 0 14px' }}>
                      日別の学習時間
                    </h2>
                    <DailyStudyChart daily={daily} width={CHART_WIDTH} />
                  </div>

                  <div style={cardStyle}>
                    <h2 style={{ ...font.cardTitle, color: color.text, margin: 0 }}>
                      すべての学習記録
                      <span
                        style={{ ...font.caption, color: color.textSubtle, marginLeft: 10 }}
                      >
                        {list.total}件
                      </span>
                    </h2>
                    <StudyLogList
                      activities={list.items}
                      loading={list.loading}
                      loadingMore={list.loadingMore}
                      hasMore={list.hasMore}
                      error={list.error}
                      onLoadMore={list.loadMore}
                    />
                  </div>
                </div>

                <div className="flex flex-col" style={{ gap: space.columnGap }}>
                  <TotalsCard
                    stats={stats}
                    loading={statsLoading}
                    rangeLabel={activeRange.label}
                    rangeMinutes={rangeMinutes}
                    rangeSessions={rangeSessions}
                    studiedDays={studiedDays}
                  />
                  <CourseBreakdownCard byCourse={stats?.byCourse ?? []} loading={statsLoading} />
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      <footer className="h-10 flex items-center justify-center" style={{ background: '#2B2629' }}>
        <span className="text-[11.4px] font-bold text-white">2026 &copy; WEBCOACH</span>
      </footer>
    </div>
  );
}

export default StudyLogPage;
