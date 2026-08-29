import { useEffect, useState } from 'react';
import { bffClient } from '../../services/bffClient';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { StudyRanking, StudyRankingEntry, StudyRankingPeriod } from '../../types/focusBooth';
import { formatMinutesHM } from '../../utils/studyStats';

/**
 * 学習時間ランキング（集中ブースの右カラム）。
 *
 * 「いろいろ表示されすぎている ⇒ タイマーとランキングでいい」という指摘を受けて追加した。
 * 統計カード・カレンダー・最近の記録をこの画面から外した代わりに置くもので、
 * 数字を並べ直すのではなく「他の人と並ぶ」という別の動機を用意するのが狙い。
 *
 * 🔴 他の受講者は仮名＋絵文字（design-token-spec.md の規約）。実名・実写真は出さない。
 * 🔴 順位はサーバ役（MSW）が確定させたものをそのまま描く。ここで並べ替えない。
 */
interface StudyRankingCardProps {
  userId?: number;
}

const PERIODS: { key: StudyRankingPeriod; label: string }[] = [
  { key: 'week', label: '今週' },
  { key: 'month', label: '今月' },
];

/** 上位3人だけメダル。4位以降は数字にして、順位そのものを主役にしない */
const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

/** 一度に見せる人数。全員出すとカードが縦に伸びてタイマーと釣り合わなくなる */
const VISIBLE_COUNT = 5;

function Row({ entry, max }: { entry: StudyRankingEntry; max: number }) {
  const ratio = max > 0 ? Math.max(entry.minutes / max, 0.02) : 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 12px',
        borderRadius: radius.md,
        background: entry.isMe ? color.primarySoft : 'transparent',
      }}
    >
      <span
        style={{
          width: 26,
          textAlign: 'center',
          flexShrink: 0,
          ...font.rowTitle,
          color: entry.isMe ? color.primary : color.textSubtle,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {MEDALS[entry.rank] ?? entry.rank}
      </span>

      <span aria-hidden style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>
        {entry.avatarEmoji}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            ...font.rowTitle,
            color: entry.isMe ? color.primary : color.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {entry.nickname}
        </div>
        {/* 分数だけだと差が読みにくいので、1位を基準にした横バーを敷く */}
        <div
          style={{
            height: 4,
            borderRadius: radius.pill,
            background: color.trackBg,
            marginTop: 5,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${ratio * 100}%`,
              height: '100%',
              borderRadius: radius.pill,
              background: entry.isMe ? color.primary : color.streakOff,
            }}
          />
        </div>
      </div>

      <span
        style={{
          ...font.caption,
          color: entry.isMe ? color.primary : color.textMuted,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {formatMinutesHM(entry.minutes)}
      </span>
    </div>
  );
}

export function StudyRankingCard({ userId }: StudyRankingCardProps) {
  const [period, setPeriod] = useState<StudyRankingPeriod>('week');
  const [ranking, setRanking] = useState<StudyRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setLoading(true);
    setFailed(false);
    bffClient
      .getStudyRanking(userId, period)
      .then((r) => alive && setRanking(r))
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [userId, period]);

  const top = ranking?.entries.slice(0, VISIBLE_COUNT) ?? [];
  const max = ranking?.entries[0]?.minutes ?? 0;
  // 自分が上位に入っていないときだけ、区切って自分の行を足す。
  // 自分がどこにいるか分からないランキングは見る意味がない。
  const meOutside = ranking && !top.some((e) => e.isMe) ? ranking.me : null;

  return (
    <div
      style={{
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.card,
        boxShadow: shadow.card,
        padding: '18px 14px 14px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '0 8px',
          marginBottom: 12,
        }}
      >
        <h2 style={{ ...font.cardTitle, color: color.text, margin: 0 }}>学習時間ランキング</h2>

        <div style={{ display: 'flex', gap: 6 }} role="tablist" aria-label="集計期間">
          {PERIODS.map((p) => {
            const active = p.key === period;
            return (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPeriod(p.key)}
                className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  borderRadius: radius.pill,
                  padding: '6px 14px',
                  border: `1px solid ${active ? color.primary : color.border}`,
                  background: active ? color.primary : color.surface,
                  color: active ? color.textOnPrimary : color.textBody,
                  fontFamily: 'inherit',
                  ...font.chip,
                  cursor: 'pointer',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {failed ? (
        <div style={{ ...font.meta, color: color.textMuted, padding: '10px 12px', lineHeight: 1.9 }}>
          ランキングを取得できませんでした。
        </div>
      ) : loading || !ranking ? (
        <div style={{ ...font.caption, color: color.textSubtle, padding: '10px 12px' }}>
          読み込んでいます…
        </div>
      ) : (
        <>
          <div className="flex flex-col" style={{ gap: 2 }}>
            {top.map((e) => (
              <Row key={`${e.rank}-${e.nickname}`} entry={e} max={max} />
            ))}
          </div>

          {meOutside && (
            <>
              <div style={{ textAlign: 'center', ...font.caption, color: color.textFaint, padding: '4px 0' }}>
                ⋯
              </div>
              <Row entry={meOutside} max={max} />
            </>
          )}

          <div
            style={{
              ...font.caption,
              color: color.textSubtle,
              borderTop: `1px solid ${color.divider}`,
              marginTop: 10,
              paddingTop: 12,
              textAlign: 'center',
            }}
          >
            {ranking.periodLabel}・{ranking.participantCount}人中 {ranking.me.rank}位
          </div>
        </>
      )}
    </div>
  );
}

export default StudyRankingCard;
