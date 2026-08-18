import { Pause, Play, Square } from 'lucide-react';
import { color, font, radius, shadow, t } from '../../theme/webcoachTheme';
import { ActiveStudySession, StudySessionMode } from '../../types/studyActivity';
import TimerDial, { DialState } from './TimerDial';
import TimerModeToggle from './TimerModeToggle';
import DurationPresets from './DurationPresets';

/**
 * 集中ブースの左カラム。タイマーと、開始前の設定をまとめて持つ。
 * 開始前をモーダルにしないのは「目標未入力でもすぐに開始できる」ことを優先するため。
 */
interface FocusTimerCardProps {
  session: ActiveStudySession | null;
  elapsedSeconds: number;
  running: boolean;
  reachedTarget: boolean;
  /** 一時停止のまま/動かしたまま長時間放置された(タイマーの消し忘れ) */
  stale: boolean;
  starting: boolean;
  /** 記録せずに破棄する(放置セッションの後始末) */
  onDiscard: () => void;
  /** 開始前の設定値(開始したらsession側が正になる) */
  mode: StudySessionMode;
  targetMinutes: number;
  onModeChange: (mode: StudySessionMode) => void;
  onTargetChange: (minutes: number) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
}

export function FocusTimerCard({
  session,
  elapsedSeconds,
  running,
  reachedTarget,
  stale,
  starting,
  onDiscard,
  mode,
  targetMinutes,
  onModeChange,
  onTargetChange,
  onStart,
  onPause,
  onResume,
  onFinish,
}: FocusTimerCardProps) {
  const activeMode = session?.mode ?? mode;
  const activeTarget = session ? session.targetMinutes : targetMinutes;
  const dialState: DialState = !session ? 'idle' : reachedTarget ? 'completed' : running ? 'running' : 'paused';

  const controlsDisabled = !!session;

  return (
    <div
      className="flex flex-col"
      style={{
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.hero,
        boxShadow: shadow.hero,
        padding: '24px 24px 22px',
        gap: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
        <h2 style={{ ...font.sectionTitle, color: color.text, margin: 0 }}>集中タイマー</h2>
        <TimerModeToggle value={activeMode} onChange={onModeChange} disabled={controlsDisabled} />
      </div>

      {/* 消し忘れの後始末。黙って記録すると累計・ストリークが壊れるため、記録するか破棄するかは必ず選ばせる */}
      {stale && (
        <div
          style={{
            background: '#FFF6E5',
            border: '1px solid #F0DDB8',
            borderRadius: radius.md,
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ ...font.meta, color: '#8A5A10', lineHeight: 1.8 }}>
            前回のタイマーが動いたままになっています。時間を確かめて記録するか、破棄してください。
          </span>
          <button
            type="button"
            onClick={onDiscard}
            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              border: `1px solid ${color.borderSoft}`,
              borderRadius: radius.pill,
              padding: '7px 16px',
              background: color.surface,
              color: color.textStrong,
              fontFamily: 'inherit',
              ...font.buttonSm,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            破棄する
          </button>
        </div>
      )}

      {/* ポモドーロ完了の告知。自動で記録はしない */}
      {reachedTarget && (
        <div
          style={{
            background: color.primarySoft,
            border: `1px solid ${color.primaryBorder}`,
            borderRadius: radius.md,
            padding: '11px 14px',
            ...font.meta,
            color: color.textBody,
          }}
        >
          {activeTarget}分の集中が完了しました。記録するか、そのまま続けられます。
        </div>
      )}

      <div className="flex justify-center">
        <TimerDial mode={activeMode} elapsedSeconds={elapsedSeconds} targetMinutes={activeTarget} state={dialState} />
      </div>

      {activeMode === 'pomodoro' && (
        <DurationPresets value={activeTarget ?? 25} onChange={onTargetChange} disabled={controlsDisabled} />
      )}

      {/* 操作は開始・一時停止・終了の3つだけ */}
      <div className="flex items-center justify-center" style={{ gap: 12, marginTop: 2 }}>
        {!session ? (
          <button
            type="button"
            onClick={onStart}
            disabled={starting}
            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              ...t.primaryButton,
              width: 260,
              justifyContent: 'center',
              cursor: starting ? 'not-allowed' : 'pointer',
              opacity: starting ? 0.6 : 1,
            }}
          >
            <Play size={16} className="fill-white" />
            {starting ? '開始しています…' : '開始'}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={running ? onPause : onResume}
              className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{ ...t.outlineButton, cursor: 'pointer', minWidth: 128, justifyContent: 'center' }}
            >
              {running ? <Pause size={15} /> : <Play size={15} />}
              {running ? '一時停止' : '再開'}
            </button>
            <button
              type="button"
              onClick={onFinish}
              className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{ ...t.primaryButton, cursor: 'pointer', minWidth: 168, justifyContent: 'center' }}
            >
              <Square size={14} />
              {reachedTarget ? '記録する' : '終了'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default FocusTimerCard;
