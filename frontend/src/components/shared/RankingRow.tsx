/**
 * ランキング1行と順位バッジ。
 *
 * マイページの「みんなのランキング」（TOP3＋自分の近く）と、学習記録ページの
 * 「学習時間ランキング／ストリークランキング」（全件）が同じ見た目の行を使うので、
 * 描画だけをここに寄せる。並べ替え・順位付けはしない（サーバ役が確定させた順に描く）。
 *
 * 🔴 他の受講者は仮名＋絵文字のみ（frontend/docs/design-token-spec.md）。
 *    実名・メールアドレス・顔写真は出さない。
 */

export interface RankingRowItem {
  rank: number;
  /** 仮名。自分の行だけ「あなた」 */
  nickname: string;
  avatarEmoji: string;
  /** 表示用に整形済みの値（「3時間23分」「12日」） */
  value: string;
  isMe: boolean;
}

/** 1〜3位はメダル色、4位以降はニュートラル。自分の行は赤ベタ */
const MEDAL: Record<number, { bg: string; fg: string }> = {
  1: { bg: '#F6C445', fg: '#7A5A00' },
  2: { bg: '#C9CDD4', fg: '#4A4F58' },
  3: { bg: '#DDA277', fg: '#5C3616' },
};

export function RankBadge({ rank, isMe, size = 22 }: { rank: number; isMe?: boolean; size?: number }) {
  const tone = isMe
    ? { bg: 'var(--dc-primary)', fg: '#fff' }
    : MEDAL[rank] ?? { bg: '#F5F1EA', fg: 'var(--dc-text-body)' };

  return (
    <span
      className="dc-num"
      style={{
        width: size,
        height: size,
        flex: 'none',
        borderRadius: 9999,
        display: 'grid',
        placeItems: 'center',
        background: tone.bg,
        color: tone.fg,
        fontSize: 'var(--dc-fs-3xs)',
        fontWeight: 800,
      }}
    >
      {rank}
    </span>
  );
}

interface RankingRowProps {
  item: RankingRowItem;
  /** 上に区切り線を引く（リストの2行目以降） */
  divided?: boolean;
  /** アバターの絵文字を出す。TOP3の要約リストでは省いて詰める */
  showAvatar?: boolean;
}

export function RankingRow({ item, divided, showAvatar = true }: RankingRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: item.isMe ? '11px 8px' : '12px 4px',
        borderTop: divided && !item.isMe ? '1px solid var(--dc-border)' : undefined,
        background: item.isMe ? 'var(--dc-soft-100)' : undefined,
        borderRadius: item.isMe ? 10 : undefined,
        margin: item.isMe ? '2px -8px' : undefined,
      }}
    >
      <RankBadge rank={item.rank} isMe={item.isMe} />

      {showAvatar && (
        <span
          aria-hidden="true"
          style={{
            width: 26,
            height: 26,
            flex: 'none',
            borderRadius: 9999,
            display: 'grid',
            placeItems: 'center',
            fontSize: 'var(--dc-fs-15)',
            lineHeight: 1,
            background: item.isMe ? '#fff' : 'var(--dc-sunken)',
            border: item.isMe ? '1px solid var(--dc-soft-200)' : '1px solid var(--dc-border)',
            boxSizing: 'border-box',
          }}
        >
          {item.avatarEmoji}
        </span>
      )}

      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 'var(--dc-fs-base)',
          fontWeight: item.isMe ? 800 : 600,
          color: item.isMe ? 'var(--dc-primary)' : 'var(--dc-text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {item.nickname}
      </span>

      <span
        className="dc-num"
        style={{
          flex: 'none',
          fontSize: 'var(--dc-fs-sm)',
          fontWeight: item.isMe ? 800 : 700,
          color: item.isMe ? 'var(--dc-primary)' : 'var(--dc-text-body)',
          whiteSpace: 'nowrap',
        }}
      >
        {item.value}
      </span>
    </div>
  );
}

export default RankingRow;
