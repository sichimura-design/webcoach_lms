import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { useStudyTimerStore } from '../../store/studyTimerStore';

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// 自習室のタイマーはページ遷移しても裏で動き続ける想定なので、App全体に常駐させる
// フローティングウィジェット。タップすると自習室画面(/focus-booth)に戻る。
function FloatingStudyTimer() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = useStudyTimerStore((s) => s.session);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const end = session.pausedAt ?? Date.now();
      setElapsedSeconds(Math.floor((end - session.startedAt) / 1000));
    };
    tick();
    if (session.pausedAt !== null) return;
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session]);

  if (!session || location.pathname === '/focus-booth') return null;

  return (
    <button
      onClick={() => navigate('/focus-booth')}
      className="fixed flex items-center gap-2.5 text-left appearance-none border-0 outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{
        bottom: 22, right: 22, zIndex: 1000,
        background: '#fff', borderRadius: 999, padding: '10px 18px 10px 12px',
        boxShadow: '0 8px 26px rgba(190,60,70,.25)',
      }}
    >
      <span
        className="flex items-center justify-center flex-shrink-0 rounded-full text-white"
        style={{ width: 32, height: 32, background: 'linear-gradient(150deg,#F0546A,#E0213A)' }}
      >
        <Clock className="w-4 h-4" />
      </span>
      <span>
        <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#9A8B8D' }}>集中ブースで学習中</span>
        <span style={{ display: 'block', fontSize: 16, fontWeight: 900, color: '#2A2230', lineHeight: 1.1 }}>
          {formatElapsed(elapsedSeconds)}
        </span>
      </span>
    </button>
  );
}

export default FloatingStudyTimer;
