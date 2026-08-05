import { useNavigate, useLocation } from 'react-router-dom';
import { Clock, Pause, Play, Square } from 'lucide-react';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';
import { useStudyTimerStore } from '../../store/studyTimerStore';
import { useStudySession } from '../../hooks/useStudySession';
import { useAuth } from '../../contexts/AuthContext';
import { formatMMSS } from '../../utils/studyStats';

/**
 * 集中タイマーはページ遷移しても裏で動き続けるので、App全体に常駐させるフローティング表示。
 * 本体をタップすると集中ブースへ戻る。一時停止／終了もここから行える
 * （終了カードは App直下の StudySessionFinishHost が描く）。
 */
const floatIconButton: React.CSSProperties = {
  width: 30,
  height: 30,
  display: 'grid',
  placeItems: 'center',
  border: 'none',
  borderRadius: 9,
  background: color.pageBg,
  color: color.textMuted,
  cursor: 'pointer',
  flexShrink: 0,
};

function FloatingStudyTimer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const session = useStudyTimerStore((s) => s.session);
  const { elapsedSeconds, running, reachedTarget, pause, resume, prepareFinish } = useStudySession(
    user?.userid
  );

  const onFocusBooth = location.pathname === '/focus-booth';
  // 教材ページは LessonTopBar のミニタイマーがあるので二重表示を避ける。
  // 🔴 startsWith('/course/') だと /course/:id/curriculum（ミニタイマーが無い）も
  //    巻き込んでタイマーが消えるので、レッスン画面だけを正規表現で除外する。
  const onLesson = /^\/course\/\d+$/.test(location.pathname);

  if (!session || onFocusBooth || onLesson) return null;

  return (
    <div
      role="group"
      aria-label="学習タイマー"
      className="fixed flex items-center"
      style={{
        bottom: 22,
        right: 22,
        zIndex: 1000,
        gap: 6,
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.pill,
        padding: '8px 8px 8px 12px',
        boxShadow: shadow.hero,
        fontFamily: font.family,
      }}
    >
      <button
        type="button"
        onClick={() => navigate('/focus-booth')}
        title="集中ブースを開く"
        className="flex items-center text-left appearance-none border-0 outline-none bg-transparent focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{ gap: 10, cursor: 'pointer', padding: 0 }}
      >
        <span
          className="grid place-items-center flex-shrink-0 rounded-full"
          style={{
            width: 32,
            height: 32,
            background: color.primary,
            color: color.textOnPrimary,
            opacity: running ? 1 : 0.55,
          }}
        >
          <Clock size={16} />
        </span>
        <span>
          <span
            style={{
              display: 'block',
              ...font.caption,
              color: color.textSubtle,
              maxWidth: 150,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {reachedTarget
              ? '目標達成！記録できます'
              : !running
                ? '一時停止中'
                : session.courseTitle || '集中して学習中'}
          </span>
          <span
            style={{
              display: 'block',
              fontSize: 16,
              fontWeight: 900,
              color: color.text,
              lineHeight: 1.15,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatMMSS(elapsedSeconds)}
          </span>
        </span>
      </button>

      <span style={{ width: 1, height: 26, background: color.divider, flexShrink: 0 }} />

      <button
        type="button"
        onClick={running ? pause : resume}
        aria-label={running ? '一時停止' : '再開'}
        title={running ? '一時停止' : '再開'}
        className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={floatIconButton}
      >
        {running ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <button
        type="button"
        onClick={prepareFinish}
        aria-label="学習を終了して記録する"
        title="終了して記録する"
        className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{ ...floatIconButton, color: color.primary }}
      >
        <Square size={12} />
      </button>
    </div>
  );
}

export default FloatingStudyTimer;
