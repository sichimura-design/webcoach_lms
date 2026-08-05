import { useState } from 'react';
import { BookOpen, Pause, Play, Square } from 'lucide-react';
import { color, font, radius, shadow, t } from '../../theme/webcoachTheme';
import { StudySessionMode } from '../../types/studyRoom';
import { ActiveStudySession } from '../../types/studyActivity';
import TimerDial, { DialState } from './TimerDial';
import TimerModeToggle from './TimerModeToggle';
import DurationPresets from './DurationPresets';
import SessionGoalBlock from './SessionGoalBlock';

/**
 * 集中ブースの左カラム。タイマーと、開始前の設定をまとめて持つ。
 *
 * 🔴 開始前をモーダルにしないのは、要件が「目標未入力でもすぐに開始できる」ことを
 *    求めているため。到達直後に「開始」の1クリックで走り出せる状態にしておく。
 *    教材選択だけは選択肢が多いので MaterialPickerModal に切り出している。
 */
interface FocusTimerCardProps {
  session: ActiveStudySession | null;
  elapsedSeconds: number;
  running: boolean;
  reachedTarget: boolean;
  /** 一時停止のまま／動かしたまま長時間放置された（タイマーの消し忘れ） */
  stale: boolean;
  /** 記録せずに破棄する（放置セッションの後始末） */
  onDiscard: () => void;
  /** 開始前の設定値（開始したら session 側が正になる） */
  mode: StudySessionMode;
  targetMinutes: number;
  goalText: string;
  materialLabel: string | null;
  onModeChange: (mode: StudySessionMode) => void;
  onTargetChange: (minutes: number) => void;
  onGoalChange: (goal: string) => void;
  onPickMaterial: () => void;
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
  onDiscard,
  mode,
  targetMinutes,
  goalText,
  materialLabel,
  onModeChange,
  onTargetChange,
  onGoalChange,
  onPickMaterial,
  onStart,
  onPause,
  onResume,
  onFinish,
}: FocusTimerCardProps) {
  const [goalOpen, setGoalOpen] = useState(false);

  const activeMode = session?.mode ?? mode;
  const activeTarget = session ? session.targetMinutes : targetMinutes;
  const dialState: DialState = !session
    ? 'idle'
    : reachedTarget
      ? 'completed'
      : running
        ? 'running'
        : 'paused';

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

      {/* 消し忘れの後始末。黙って記録すると10時間超の記録が生まれ、累計もストリークも壊れる。
          記録するか破棄するかは必ず受講生に決めてもらう。 */}
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

      {/* ポモドーロ完了の告知。自動で記録はしない（続けるか記録するかは受講生が決める） */}
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
        <TimerDial
          mode={activeMode}
          elapsedSeconds={elapsedSeconds}
          targetMinutes={activeTarget}
          state={dialState}
        />
      </div>

      {activeMode === 'pomodoro' && (
        <DurationPresets
          value={activeTarget ?? 25}
          onChange={onTargetChange}
          disabled={controlsDisabled}
        />
      )}

      <SessionGoalBlock
        value={session?.goalText ?? goalText}
        onChange={onGoalChange}
        editing={goalOpen}
        onToggleEditing={() => setGoalOpen((v) => !v)}
      />

      {/* 教材は開始前だけここで変えられる（稼働中は右上のカードから変える） */}
      {!session && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '11px 14px',
            border: `1px solid ${color.border}`,
            borderRadius: radius.md,
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: color.primarySoft,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <BookOpen size={14} style={{ color: color.primary }} />
          </span>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              ...font.meta,
              color: materialLabel ? color.text : color.textFaint,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {materialLabel ?? '教材を指定しない'}
          </span>
          <button
            type="button"
            onClick={onPickMaterial}
            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{ ...t.chip, border: 'none', cursor: 'pointer', flexShrink: 0 }}
          >
            教材を選ぶ
          </button>
        </div>
      )}

      {/* 操作は開始・一時停止・終了の3つだけ（リセットは置かない） */}
      <div className="flex items-center justify-center" style={{ gap: 12, marginTop: 2 }}>
        {!session ? (
          <button
            type="button"
            onClick={onStart}
            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{ ...t.primaryButton, width: 260, justifyContent: 'center', cursor: 'pointer' }}
          >
            <Play size={16} className="fill-white" />
            開始
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
