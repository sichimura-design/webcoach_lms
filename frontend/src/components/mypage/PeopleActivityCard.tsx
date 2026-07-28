import { useNavigate } from 'react-router-dom';
import { useFocusBoothMembers } from '../../hooks/useFocusBoothMembers';
import { color, radius, shadow, font } from '../../theme/webcoachTheme';
import { ArrowRightIcon } from './ContinueLearningHero';

const AVATAR_BY_EMOJI: Record<string, string> = {
  '🐰': 'avatar-usagi.png',
  '🐨': 'avatar-koara.png',
  '🐼': 'avatar-panda.png',
};

function avatarSrc(emoji: string): string {
  return `${process.env.PUBLIC_URL}/images/home/${AVATAR_BY_EMOJI[emoji] || 'avatar-user.png'}`;
}

function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function PeopleActivityCard() {
  const navigate = useNavigate();
  const { members } = useFocusBoothMembers();

  return (
    <section style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius.card, boxShadow: shadow.card, padding: '22px 20px 20px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ ...font.cardTitle, color: color.text, padding: '0 4px' }}>いまのギルドメンバー</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
        {members.slice(0, 3).map((m) => (
          <div
            key={m.id}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', border: `1px solid ${color.border}`, borderRadius: radius.md, background: color.surface }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = color.primaryBorderSoft; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = color.border; }}
          >
            <img src={avatarSrc(m.avatarEmoji)} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: color.text }}>{m.nickname}</div>
              <div style={{ fontSize: 11.5, color: color.textSubtle, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.activityLabel}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: color.textSecondary, fontVariantNumeric: 'tabular-nums' }}>{formatClock(m.elapsedMinutes)}</span>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color.online }} />
            </div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 14 }} />
      <button
        onClick={() => navigate('/focus-booth')}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', background: color.surface, border: `1px solid ${color.borderSoft}`, borderRadius: radius.md, padding: '14px 16px', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: color.textStrong, cursor: 'pointer' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = color.hoverBgTint; e.currentTarget.style.borderColor = color.primaryBorderSoft; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = color.surface; e.currentTarget.style.borderColor = color.borderSoft; }}
      >
        <span>メンバーをもっと見る</span>
        <ArrowRightIcon size={15} stroke={color.textMuted} />
      </button>
    </section>
  );
}

export default PeopleActivityCard;
