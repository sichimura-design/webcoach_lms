import { useNavigate } from 'react-router-dom';
import { color, radius, shadow, font } from '../../theme/webcoachTheme';
import { ArrowRightIcon } from './ContinueLearningHero';

interface GuildLobbyCardProps {
  onlineCount: number;
}

function GuildLobbyCard({ onlineCount }: GuildLobbyCardProps) {
  const navigate = useNavigate();
  const enter = () => navigate('/focus-booth');

  return (
    <section style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.card, boxShadow: shadow.card, padding: '20px 20px 20px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 4px 14px' }}>
        <div style={{ ...font.cardTitle, color: color.text }}>ギルドロビー</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: color.online }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: color.textMuted }}>いま{onlineCount}人が学習中</span>
        </div>
        <div style={{ flex: 1 }} />
        <div onClick={enter} role="button" tabIndex={0} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 700, color: color.primary, cursor: 'pointer' }}>
          <span>ギルドブースに入る</span>
          <ArrowRightIcon size={14} stroke={color.primary} />
        </div>
      </div>
      <div style={{ position: 'relative', flex: 1, borderRadius: radius.md, overflow: 'hidden', minHeight: 290 }}>
        <img src={`${process.env.PUBLIC_URL}/images/home/guild-lobby.png`} alt="ギルドロビー" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        <button
          onClick={enter}
          style={{ position: 'absolute', left: 16, bottom: 16, display: 'flex', alignItems: 'center', gap: 10, background: color.primarySoftAlt, color: color.primary, border: 'none', borderRadius: radius.sm, padding: '13px 20px', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', boxShadow: shadow.overlayButton }}
          onMouseEnter={(e) => { e.currentTarget.style.background = color.primarySoftHover; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = color.primarySoftAlt; }}
        >
          <span>ギルドブースに入る</span>
          <ArrowRightIcon size={15} stroke={color.primary} />
        </button>
      </div>
    </section>
  );
}

export default GuildLobbyCard;
