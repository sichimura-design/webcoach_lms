import { useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AppHeader } from '../shared';
import { useStudyStats } from '../../hooks/useStudyStats';
import { useStudyActivities } from '../../hooks/useStudyActivities';
import { useScaleToFit } from '../../hooks/useScaleToFit';
import { color, font, radius, shadow, space } from '../../theme/webcoachTheme';
import { toLocalDateKey } from '../../utils/studyStats';
import PageTitleBar from '../shared/PageTitleBar';
import StudyLogList from './StudyLogList';
import StudySummaryCard from './StudySummaryCard';

const DESIGN_WIDTH = 1440;

type RangeKey = '30d' | '3m' | 'all';

const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: '30d', label: '直近30日', days: 30 },
  { key: '3m', label: '直近3ヶ月', days: 92 },
  { key: 'all', label: '全期間', days: 400 },
];

/**
 * 学習記録（自習室タブの2つ目）。集中ブースの「学習履歴をすべて見る」からも来る。
 *
 * 以前は「日別の棒グラフ ＋ 累計カード（5行）＋ 教材別の内訳 ＋ 全履歴」の4面構成で、
 * 「色々書いてありすぎる」という指摘を受けた。
 * 数字は4つ（期間の学習時間・学習した日数・今週・連続日数）だけに絞り、
 * グラフと教材別内訳は落として、サマリーと履歴の2カードにした。
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
            <PageTitleBar
              title="学習記録"
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
              <div className="flex flex-col" style={{ gap: space.columnGap }}>
                <StudySummaryCard
                  stats={stats}
                  loading={statsLoading}
                  rangeLabel={activeRange.label}
                  rangeMinutes={rangeMinutes}
                  studiedDays={studiedDays}
                />

                <div style={cardStyle}>
                  <h2 style={{ ...font.cardTitle, color: color.text, margin: 0 }}>
                    学習履歴
                    <span style={{ ...font.caption, color: color.textSubtle, marginLeft: 10 }}>
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
