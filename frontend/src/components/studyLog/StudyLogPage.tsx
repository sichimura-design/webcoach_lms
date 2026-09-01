import { useState } from 'react';
import { Clock, Flame } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AppFooter, AppHeader } from '../shared';
import { useStudyStats } from '../../hooks/useStudyStats';
import { useStudyActivities } from '../../hooks/useStudyActivities';
import { useStreakRanking, useStudyRanking } from '../../hooks/useRankings';
import { StreakRankingPeriod, StudyRankingPeriod } from '../../types/focusBooth';
import { formatMinutesHM } from '../../utils/studyStats';
import { RankingRowItem } from '../shared/RankingRow';
import StudyLogList from './StudyLogList';
import StudyRecordPanel from './StudyRecordPanel';
import StreakCalendarCard from './StreakCalendarCard';
import RankingListCard from './RankingListCard';

/**
 * 学習記録・ランキング（/study-log）。claude.ai/design『トップページ 3案』4a 準拠。
 *
 * マイページのストリークカード・学習記録カード・みんなのランキングの
 * 「詳しく見る／もっと見る」がすべてここに着地する。
 *
 * 【レイアウト方式】
 * 🔴 useScaleToFit（1440px の固定キャンバスを transform:scale で縮小）は使わない。
 *    4a が fr ベースの流動レイアウトになったので、マイページと同じく素直に折り返す。
 *    scale 方式は狭い画面で文字まで一緒に縮んで読めなくなるのが難点だった。
 *
 * 【データ取得】
 * 🔴 学習記録は useStudyStats(userId, 92) の1本だけ。期間タブ（1週間 / 30日間 / 3ヶ月）と
 *    週送り・月送りは、この92日ぶんの dailyTotals をクライアント側で切り出して作る。
 *    タブごとに days を変えて叩くと、切り替えのたびに画面が読み込み中へ戻る。
 *
 * 【構成】
 *   ① 学習記録（期間タブ / KPI×4 / 棒グラフ）
 *   ② ストリークカレンダー
 *   ③ 学習時間ランキング ｜ ストリークランキング
 *   ④ 学習履歴（4a には無いが、掘り下げの終点として残している）
 */

/** dailyTotals をまとめて取る日数。3ヶ月タブ（13週）とカレンダー3か月ぶんを1回で賄う */
const STATS_DAYS = 92;

function StudyLogPage() {
  const { user } = useAuth();
  const userId = user?.userid;

  const { stats, loading: statsLoading, unavailable } = useStudyStats(userId, STATS_DAYS);

  const [timePeriod, setTimePeriod] = useState<StudyRankingPeriod>('week');
  const [streakPeriod, setStreakPeriod] = useState<StreakRankingPeriod>('month');
  const time = useStudyRanking(userId, timePeriod);
  const streak = useStreakRanking(userId, streakPeriod);

  // 履歴は全期間。件数が多いので useStudyActivities のページングに任せる
  const list = useStudyActivities(userId);

  const timeItems: RankingRowItem[] = (time.ranking?.entries ?? []).map((e) => ({
    rank: e.rank,
    nickname: e.isMe ? 'あなた' : e.nickname,
    avatarEmoji: e.avatarEmoji,
    value: formatMinutesHM(e.minutes),
    isMe: e.isMe,
  }));

  const streakItems: RankingRowItem[] = (streak.ranking?.entries ?? []).map((e) => ({
    rank: e.rank,
    nickname: e.isMe ? 'あなた' : e.nickname,
    avatarEmoji: e.avatarEmoji,
    value: `${e.days}日`,
    isMe: e.isMe,
  }));

  const cardStyle: React.CSSProperties = {
    background: 'var(--dc-surface)',
    border: '1px solid var(--dc-border)',
    borderRadius: 'var(--dc-radius-lg)',
    boxShadow: 'var(--dc-shadow-card)',
    padding: 'var(--dc-sp-card-y) var(--dc-sp-card-x)',
  };

  return (
    <div className="mypage-3d min-h-screen flex flex-col" style={{ background: 'var(--dc-bg)' }}>
      <AppHeader userName={user?.username || 'User'} />

      <main
        className="dc-page-main flex flex-col"
        style={{ flex: 1, padding: 'var(--dc-sp-page-y) var(--dc-sp-page-x) calc(var(--dc-sp-page-y) * 0.8)', color: 'var(--dc-text)' }}
      >
        <div style={{ marginBottom: 22 }}>
          <h1
            style={{
              margin: '0 0 8px',
              fontSize: 'var(--dc-fs-display)',
              lineHeight: 'var(--dc-lh-heading)',
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'var(--dc-text)',
            }}
          >
            学習記録・ランキング
          </h1>
          <p style={{ margin: 0, fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-body)' }}>
            学習の記録とランキングをまとめて確認できます。
          </p>
        </div>

        {unavailable ? (
          <div style={{ ...cardStyle, fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-muted)', lineHeight: 'var(--dc-lh-prose)' }}>
            学習記録を表示できませんでした。この機能はモック環境でのみ利用できます。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--dc-sp-gap)' }}>
            <StudyRecordPanel stats={stats} loading={statsLoading} />

            <StreakCalendarCard stats={stats} loading={statsLoading} />

            <div className="studylog-rank-grid">
              <RankingListCard
                title="学習時間ランキング"
                icon={<Clock size={16} strokeWidth={1.75} />}
                iconBackground="var(--dc-soft-100)"
                iconColor="var(--dc-primary)"
                periods={[
                  { key: 'week', label: '週間' },
                  { key: 'month', label: '月間' },
                ]}
                activePeriod={timePeriod}
                onPeriodChange={(k) => setTimePeriod(k as StudyRankingPeriod)}
                items={timeItems}
                footer={
                  time.ranking
                    ? `${time.ranking.periodLabel}・${time.ranking.participantCount}人中 ${time.ranking.me.rank}位`
                    : undefined
                }
                loading={time.loading}
                failed={time.failed}
              />

              <RankingListCard
                title="ストリークランキング"
                icon={<Flame size={16} strokeWidth={1.75} />}
                iconBackground="var(--dc-gold-surface)"
                iconColor="var(--dc-gold)"
                periods={[
                  { key: 'month', label: '月間' },
                  { key: 'total', label: '累計' },
                ]}
                activePeriod={streakPeriod}
                onPeriodChange={(k) => setStreakPeriod(k as StreakRankingPeriod)}
                items={streakItems}
                footer={
                  streak.ranking
                    ? `${streak.ranking.periodLabel}の学習日数・${streak.ranking.participantCount}人中 ${streak.ranking.me.rank}位`
                    : undefined
                }
                loading={streak.loading}
                failed={streak.failed}
              />
            </div>

            {/* 4a には無いが、1件ずつの記録を確認・削除する場所がここしか無いので残している */}
            <section style={cardStyle}>
              <h2 style={{ margin: 0, fontSize: 'var(--dc-fs-lead)', fontWeight: 700, color: 'var(--dc-text)' }}>
                学習履歴
                <span className="dc-num" style={{ fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-subtle)', marginLeft: 10 }}>
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
            </section>
          </div>
        )}

        <AppFooter />
      </main>
    </div>
  );
}

export default StudyLogPage;
