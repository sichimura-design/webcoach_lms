/**
 * frontend/src/components/learningPlan/StageRail.tsx
 * 「全体のロードマップ」= 4ステージの横一本道 ＋ 現在ステージの内訳。
 *
 * 【なぜ7フェーズをそのまま並べないか】
 * 7つ並べると1つ押しただけで残り6つが連鎖して見え、計画どおりでも遅れて見える。
 * 上段は基礎・実践・準備・挑戦の4つに束ね、内訳（フェーズ）は
 * **いま進んでいるステージの中だけ**を下段に開く。
 * 束ねているのは表示だけで、plan.phases は7つのまま保持される。
 */
import { PhaseProgressStatus, PlanStage } from '../../types/learningPlan';
import { diffDays, formatJpDate, toIso } from '../../utils/learningPlanTemplate';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

const STATUS_LABEL: Record<PhaseProgressStatus, string> = {
  done: '完了',
  current: 'いまここ',
  todo: 'これから',
};

function StatusChip({ status }: { status: PhaseProgressStatus }) {
  const isCurrent = status === 'current';
  return (
    <span
      style={{
        ...font.chip,
        borderRadius: radius.pill,
        padding: '4px 11px',
        whiteSpace: 'nowrap',
        color: isCurrent ? color.primary : color.textSubtle,
        background: isCurrent ? color.primarySoft : color.hoverBg,
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

// ============================================================
// 上段: 4ステージのレール
// ============================================================

function StageNode({ stage, index }: { stage: PlanStage; index: number }) {
  const { status } = stage;
  const isCurrent = status === 'current';

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 11, minWidth: 0 }}>
      {status === 'done' ? (
        <span
          style={{
            width: 34, height: 34, borderRadius: '50%', background: color.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: shadow.stepRing,
          }}
        >
          <CheckIcon />
        </span>
      ) : (
        <span
          style={{
            width: 34, height: 34, borderRadius: '50%', boxSizing: 'border-box',
            background: color.surface,
            border: isCurrent ? `3px solid ${color.primary}` : `2px solid ${color.borderNeutral}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13.5, fontWeight: 900,
            color: isCurrent ? color.primary : color.textSubtle,
            boxShadow: isCurrent ? shadow.currentStep : shadow.stepRing,
          }}
        >
          {index + 1}
        </span>
      )}

      <span
        style={{
          fontSize: 14, fontWeight: isCurrent ? 900 : 700, textAlign: 'center', lineHeight: 1.4,
          color: isCurrent ? color.primary : status === 'done' ? color.textSecondary : color.textSubtle,
        }}
      >
        {stage.title}
      </span>
      <span style={{ ...font.caption, color: color.textFaint, textAlign: 'center', lineHeight: 1.5 }}>
        {stage.note}
      </span>
      <span style={{ ...font.caption, color: color.textFaint, textAlign: 'center' }}>
        {formatJpDate(stage.startDate)}〜{formatJpDate(stage.endDate)}
      </span>
      <StatusChip status={status} />
    </div>
  );
}

// ============================================================
// 下段: 現在ステージの内訳
// ============================================================

function StageBreakdown({ stage }: { stage: PlanStage }) {
  const today = toIso(new Date());

  return (
    <div
      style={{
        marginTop: 26, padding: '18px 20px 16px',
        background: color.hoverBgTint, border: `1px solid ${color.borderSoft}`, borderRadius: radius.md,
      }}
    >
      <div style={{ ...font.caption, color: color.textMuted, marginBottom: 14 }}>
        「{stage.title}」の中身
      </div>

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }}>
        {stage.phases.map((phase, i) => {
          const status = stage.phaseStatuses[i] ?? 'todo';
          const isCurrent = status === 'current';
          const weeks = Math.max(1, Math.round(diffDays(phase.startDate, phase.endDate) / 7));
          const remainingWeeks = Math.max(0, Math.round(diffDays(today, phase.endDate) / 7));

          return (
            <div
              key={phase.key + phase.startDate}
              style={{
                flex: '1 1 170px', minWidth: 150,
                background: color.surface,
                border: `1px solid ${isCurrent ? color.primaryBorder : color.border}`,
                borderRadius: radius.sm, padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 8, height: 8, borderRadius: '50%', flex: '0 0 8px',
                    background: status === 'done' ? color.primary : isCurrent ? color.primary : color.trackBg,
                    opacity: status === 'done' ? 0.45 : 1,
                  }}
                />
                <span style={{ fontSize: 13, fontWeight: isCurrent ? 900 : 700, color: isCurrent ? color.primary : color.textStrong }}>
                  {phase.title}
                </span>
              </div>
              <div style={{ ...font.caption, color: color.textFaint, marginTop: 8 }}>
                {formatJpDate(phase.startDate)}〜{formatJpDate(phase.endDate)}・約{weeks}週間
              </div>
              {isCurrent && (
                <div style={{ ...font.caption, color: color.primary, fontWeight: 700, marginTop: 6 }}>
                  このフェーズは残り{remainingWeeks}週間
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// 本体
// ============================================================

interface StageRailProps {
  stages: PlanStage[];
  currentStage: PlanStage | null;
  /** 現在ステージの内訳を下に開くか。マイページの要約帯では省く。 */
  showBreakdown?: boolean;
}

function StageRail({ stages, currentStage, showBreakdown = true }: StageRailProps) {
  const n = stages.length;
  if (n === 0) return null;

  // 端のノードは列の中央にあるので、レールの左右を半列分だけ内側に寄せる
  const inset = 100 / (n * 2);
  const span = 100 - inset * 2;
  const doneCount = stages.filter((s) => s.status === 'done').length;
  const progressFraction = n > 1 ? doneCount / (n - 1) : 0;

  return (
    <div>
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, alignItems: 'start', gap: 8 }}>
        <div style={{ position: 'absolute', left: `${inset}%`, right: `${inset}%`, top: 16, height: 3, background: color.trackBg, borderRadius: 2 }} />
        <div style={{ position: 'absolute', left: `${inset}%`, width: `${span * Math.min(1, progressFraction)}%`, top: 16, height: 3, background: color.primary, borderRadius: 2 }} />

        {stages.map((stage, i) => (
          <StageNode key={stage.key} stage={stage} index={i} />
        ))}
      </div>

      {showBreakdown && currentStage && currentStage.phases.length > 1 && <StageBreakdown stage={currentStage} />}
    </div>
  );
}

export default StageRail;
