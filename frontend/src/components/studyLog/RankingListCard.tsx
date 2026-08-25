import { RankingRow, RankingRowItem } from '../shared/RankingRow';

/**
 * ランキング1枚ぶんのカード（/study-log の③）。
 * claude.ai/design『トップページ 3案』4a の「学習時間ランキング」「ストリークランキング」を
 * 同じ器で描くための汎用コンポーネント。
 *
 * マイページの PeerRankingCard が「TOP3 ＋ 自分の近く」に絞るのに対し、
 * こちらは全件を通しで出す。順位表をちゃんと見に来た人向けの画面なので省略しない。
 *
 * 🔴 並べ替えはしない。entries はサーバ役（MSW）が確定させた順のまま渡すこと。
 */
interface RankingListCardProps {
  title: string;
  /** 見出し左の丸バッジ。中身はアイコン */
  icon: React.ReactNode;
  /** バッジの地色・線色（学習時間＝赤系、ストリーク＝ゴールド系） */
  iconBackground: string;
  iconColor: string;
  periods: { key: string; label: string }[];
  activePeriod: string;
  onPeriodChange: (key: string) => void;
  items: RankingRowItem[];
  footer?: string;
  loading?: boolean;
  failed?: boolean;
}

export function RankingListCard({
  title,
  icon,
  iconBackground,
  iconColor,
  periods,
  activePeriod,
  onPeriodChange,
  items,
  footer,
  loading,
  failed,
}: RankingListCardProps) {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <span
          style={{
            width: 'var(--dc-sz-badge)',
            height: 'var(--dc-sz-badge)',
            flex: 'none',
            borderRadius: 9999,
            background: iconBackground,
            color: iconColor,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {icon}
        </span>
        <h2
          style={{
            margin: 0,
            flex: 1,
            fontSize: 'var(--dc-fs-title)',
            fontWeight: 700,
            color: 'var(--dc-text)',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </h2>

        <div style={{ display: 'flex', gap: 6 }} role="tablist" aria-label={`${title}の集計期間`}>
          {periods.map((p) => {
            const active = p.key === activePeriod;
            return (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onPeriodChange(p.key)}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  padding: '5px 12px',
                  borderRadius: 9999,
                  fontFamily: 'inherit',
                  fontSize: 'var(--dc-fs-xs)',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  border: `1px solid ${active ? 'var(--dc-primary)' : '#E5DED3'}`,
                  background: active ? 'var(--dc-primary)' : '#fff',
                  color: active ? '#fff' : 'var(--dc-text-body)',
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
        <div style={{ fontSize: 'var(--dc-fs-sm)', color: 'var(--dc-text-muted)', lineHeight: 1.9 }}>
          ランキングを取得できませんでした。
        </div>
      ) : loading || items.length === 0 ? (
        <div style={{ fontSize: 'var(--dc-fs-sm)', color: 'var(--dc-text-subtle)', padding: '20px 0' }}>読み込んでいます…</div>
      ) : (
        <>
          <div style={{ border: '1px solid var(--dc-border)', borderRadius: 14, padding: '6px 16px' }}>
            {items.map((item, i) => (
              <RankingRow key={`${item.rank}-${item.nickname}`} item={item} divided={i > 0} />
            ))}
          </div>
          {footer && (
            <div style={{ padding: '10px 4px 0', fontSize: 'var(--dc-fs-2xs)', color: 'var(--dc-text-subtle)' }}>{footer}</div>
          )}
        </>
      )}
    </section>
  );
}

export default RankingListCard;
