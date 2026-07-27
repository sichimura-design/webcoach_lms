import { useNavigate } from 'react-router-dom';
import { CommunityPulse } from '../../types/mypage';

interface PeopleActivityCardProps {
  pulse: CommunityPulse;
}

function PeopleActivityCard({ pulse }: PeopleActivityCardProps) {
  const navigate = useNavigate();

  return (
    <div
      className="bg-white flex flex-col flex-1"
      style={{ borderRadius: 20, boxShadow: '0 8px 26px rgba(190,60,70,.08)', padding: '24px 26px', gap: 16, minWidth: 260 }}
    >
      <div style={{ fontWeight: 700, color: '#2A2230', fontSize: 16 }}>他の人の様子</div>

      <div className="relative overflow-hidden" style={{ borderRadius: 14, height: 96 }}>
        <img src={`${process.env.PUBLIC_URL}/guild-lobby-bg.png`} alt="ギルドロビー" className="w-full h-full object-cover" style={{ display: 'block' }} />
        <span
          className="absolute"
          style={{ top: 8, right: 8, background: 'rgba(255,255,255,.94)', color: '#E0213A', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999 }}
        >
          いま{pulse.totalToday}人が学習と交流中!
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {pulse.activityFeed.slice(0, 4).map((a) => (
          <div key={a.id} className="flex items-center" style={{ gap: 10 }}>
            <span
              className="flex items-center justify-center rounded-full flex-shrink-0"
              style={{ width: 30, height: 30, background: '#F6D2D2', fontSize: 15 }}
            >
              {a.avatarEmoji}
            </span>
            <span className="flex-1 min-w-0" style={{ fontSize: 13, color: '#3A2F35' }}>
              <span style={{ fontWeight: 700 }}>{a.nickname}</span>
              <span style={{ color: '#9A8B8D', marginLeft: 6 }}>{a.activityLabel}</span>
            </span>
            <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: '#E0213A', background: '#FCE7E7', padding: '3px 9px', borderRadius: 999 }}>
              {a.tag}
            </span>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate('/focus-booth')}
        className="inline-flex items-center justify-center gap-2 text-white font-bold appearance-none border-0 outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{ background: '#E0213A', borderRadius: 999, padding: '12px 0', fontSize: 14 }}
      >
        みんなの学習ルームへ ▶
      </button>
    </div>
  );
}

export default PeopleActivityCard;
