import { useNavigate } from 'react-router-dom';
import { Badge } from '../../types/mypage';

interface RecentBadgesRowProps {
  badges: Badge[];
}

const RARITY_COLOR: Record<Badge['rarity'], string> = {
  common: '#9A8B8D',
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#E0213A',
};

// バッジごとに見た目のバリエーションを出す（すべて同じ🏅だと単調なため）
const BADGE_EMOJI: Record<number, string> = {
  1: '🔥', 2: '🎓', 3: '⭐', 4: '🛡️', 5: '🏆', 6: '👑', 7: '💼', 8: '💎',
};
const FALLBACK_EMOJI_BY_RARITY: Record<Badge['rarity'], string> = {
  common: '🏅', rare: '🎖️', epic: '🏆', legendary: '👑',
};

function RecentBadgesRow({ badges }: RecentBadgesRowProps) {
  const navigate = useNavigate();

  if (badges.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#2A2230' }}>最近のバッジ</span>
      </div>
      <button
        onClick={() => navigate('/badges')}
        className="flex appearance-none border-0 outline-none bg-transparent focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{ gap: 10 }}
      >
        {badges.map((badge) => (
          <span
            key={badge.id}
            title={badge.name}
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{
              width: 36, height: 36, fontSize: 17,
              background: `${RARITY_COLOR[badge.rarity]}1A`,
              border: `1.5px solid ${RARITY_COLOR[badge.rarity]}`,
            }}
          >
            {BADGE_EMOJI[badge.id] ?? FALLBACK_EMOJI_BY_RARITY[badge.rarity]}
          </span>
        ))}
      </button>
    </div>
  );
}

export default RecentBadgesRow;
