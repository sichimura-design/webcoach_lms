import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Medal } from 'lucide-react';
import { useStreakRanking, useStudyRanking } from '../../hooks/useRankings';
import { StreakRankingPeriod, StudyRankingPeriod } from '../../types/focusBooth';
import { formatMinutesHM } from '../../utils/studyStats';
import { RankingRow, RankingRowItem } from '../shared/RankingRow';

/**
 * みんなのランキング（マイページ右下）。claude.ai/design『トップページ 3案』5a 準拠。
 *
 * 全件は出さない。「TOP3」と「あなたの近く」の2ブロックだけに絞り、
 * 全順位は /study-log（4a）に任せる。中位の受講生にとって
 * 1〜9位の通し表は自分の行を探す作業になってしまうため。
 *
 * 🔴 種別（学習時間／ストリーク）と期間はどちらもこのカード内の状態。
 *    選択に応じて別のエンドポイントを引く。順位はサーバ役が確定させたものをそのまま使う。
 * 🔴 他の受講者は仮名＋絵文字のみ。実名・実写真は出さない。
 */
interface PeerRankingCardProps {
  userId?: number;
}

type Kind = 'time' | 'streak';

/** 期間ピル。種別によって選択肢が変わる（時間＝週間/月間、ストリーク＝月間/累計） */
function PeriodPills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6 }} role="tablist" aria-label="集計期間">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.key)}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              padding: '5px 12px',
              borderRadius: 9999,
              fontFamily: 'inherit',
              fontSize: 'var(--dc-fs-body)',
              fontWeight: active ? 700 : 500,
              background: active ? 'var(--dc-primary)' : '#fff',
              border: `1px solid ${active ? 'var(--dc-primary)' : '#E5DED3'}`,
              color: active ? '#fff' : 'var(--dc-text-body)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Block({ title, items }: { title: string; items: RankingRowItem[] }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 'var(--dc-fs-body)', fontWeight: 500, color: 'var(--dc-text-muted)', marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ border: '1px solid var(--dc-border)', borderRadius: 14, padding: '4px 16px' }}>
        {items.map((item, i) => (
          <RankingRow key={`${item.rank}-${item.nickname}`} item={item} divided={i > 0} showAvatar={false} />
        ))}
      </div>
    </div>
  );
}

export function PeerRankingCard({ userId }: PeerRankingCardProps) {
  const navigate = useNavigate();
  const [kind, setKind] = useState<Kind>('time');
  const [timePeriod, setTimePeriod] = useState<StudyRankingPeriod>('week');
  const [streakPeriod, setStreakPeriod] = useState<StreakRankingPeriod>('month');

  // 🔴 hook は毎回2本とも呼ぶ（条件付き呼び出しは React のルール違反）。
  //    表示していない側もキャッシュ代わりに温まるので、タブ切替が待たされない。
  const time = useStudyRanking(userId, timePeriod);
  const streak = useStreakRanking(userId, streakPeriod);

  const active = kind === 'time' ? time : streak;

  const items: RankingRowItem[] =
    kind === 'time'
      ? (time.ranking?.entries ?? []).map((e) => ({
          rank: e.rank,
          nickname: e.isMe ? 'あなた' : e.nickname,
          avatarEmoji: e.avatarEmoji,
          value: formatMinutesHM(e.minutes),
          isMe: e.isMe,
        }))
      : (streak.ranking?.entries ?? []).map((e) => ({
          rank: e.rank,
          nickname: e.isMe ? 'あなた' : e.nickname,
          avatarEmoji: e.avatarEmoji,
          value: `${e.days}日`,
          isMe: e.isMe,
        }));

  const top3 = items.slice(0, 3);
  const myIndex = items.findIndex((i) => i.isMe);
  // 自分の前後1件ずつ。TOP3 と重ならないように 4位以降から切る。
  // 自分が TOP3 に入っているときは自分の行が左に出ているので、右は「次の順位」に切り替える。
  const inTop3 = myIndex >= 0 && myIndex < 3;
  const near =
    myIndex < 0 ? [] : inTop3 ? items.slice(3, 6) : items.slice(Math.max(3, myIndex - 1), myIndex + 2);
  const nearTitle = inTop3 ? '次の順位' : 'あなたの近く';

  const periodLabel =
    kind === 'time' ? time.ranking?.periodLabel : streak.ranking?.periodLabel;

  return (
    <section
      style={{
        background: 'var(--dc-surface)',
        border: '1px solid var(--dc-border)',
        borderRadius: 'var(--dc-radius-lg)',
        boxShadow: 'var(--dc-shadow-card)',
        padding: 'var(--dc-sp-card-y) var(--dc-sp-card-x)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <span
          style={{
            width: 'var(--dc-sz-badge)',
            height: 'var(--dc-sz-badge)',
            flex: 'none',
            borderRadius: 9999,
            background: 'var(--dc-gold-surface)',
            color: 'var(--dc-gold)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Medal size={16} strokeWidth={1.75} />
        </span>
        {/* 🔴 日本語は既定でどこでも折り返すので、放っておくと
            「みんなのランキ／ング」と語中で割れる。見出しは折らず、
            入りきらないときは右のピル側を次の行へ落とす（flexWrap）。 */}
        <h2
          style={{
            margin: 0,
            flex: 1,
            fontSize: 'var(--dc-fs-lead)',
            fontWeight: 700,
            color: 'var(--dc-text)',
            whiteSpace: 'nowrap',
          }}
        >
          みんなのランキング
        </h2>

        {kind === 'time' ? (
          <PeriodPills
            options={[
              { key: 'week' as StudyRankingPeriod, label: '週間' },
              { key: 'month' as StudyRankingPeriod, label: '月間' },
            ]}
            value={timePeriod}
            onChange={setTimePeriod}
          />
        ) : (
          <PeriodPills
            options={[
              { key: 'month' as StreakRankingPeriod, label: '月間' },
              { key: 'total' as StreakRankingPeriod, label: '累計' },
            ]}
            value={streakPeriod}
            onChange={setStreakPeriod}
          />
        )}

        <button
          type="button"
          onClick={() => navigate('/study-log')}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            marginLeft: 6,
            border: 0,
            background: 'transparent',
            padding: 0,
            fontFamily: 'inherit',
            fontSize: 'var(--dc-fs-body)',
            fontWeight: 600,
            color: 'var(--dc-primary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          もっと見る
          <ChevronRight size={14} strokeWidth={2} />
        </button>
      </div>

      {/* 種別タブ。学習時間だけだと「毎日短く続ける人」が上位に出ないので2軸を用意する */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 22 }} role="tablist" aria-label="ランキングの種類">
        {([
          { key: 'time' as Kind, label: '学習時間' },
          { key: 'streak' as Kind, label: 'ストリーク' },
        ]).map((t) => {
          const isActive = t.key === kind;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setKind(t.key)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                padding: '5px 14px',
                borderRadius: 9999,
                border: 0,
                fontFamily: 'inherit',
                fontSize: 'var(--dc-fs-body)',
                fontWeight: isActive ? 700 : 500,
                background: isActive ? 'var(--dc-primary)' : '#F5F1EA',
                color: isActive ? '#fff' : 'var(--dc-text-body)',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {active.failed ? (
        <div style={{ fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-muted)', lineHeight: 'var(--dc-lh-prose)' }}>
          ランキングを取得できませんでした。
        </div>
      ) : active.loading || items.length === 0 ? (
        <div style={{ fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-subtle)', padding: '20px 0' }}>
          読み込んでいます…
        </div>
      ) : (
        <div className="mypage-rank-split">
          <div>
            <Block title="TOP3" items={top3} />
            {periodLabel && (
              <div style={{ marginTop: 10, fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-subtle)' }}>
                {kind === 'time' ? `集計期間：${periodLabel}` : `${periodLabel}の学習日数`}
              </div>
            )}
          </div>
          {near.length > 0 && <Block title={nearTitle} items={near} />}
        </div>
      )}
    </section>
  );
}

export default PeerRankingCard;
