/**
 * frontend/src/components/learningPlan/PhaseJourney.tsx
 * 学習ロードマップの「全体の道筋」。
 *
 * StageRail.tsx とは役割が違う:
 *   StageRail  … マイページの帯。現在ステージの内訳（フェーズ）まで開く
 *   PhaseJourney … ロードマップ画面の主役。内訳を出さず、道筋と現在地だけを見せる
 *
 * 【なぜ内訳を出さないか】
 * 「細かなTodoや期限まで載せると、全体としてどこを目指していて今どこにいるのかが
 * 分かりづらい」というレビュー指摘への対応。この画面が答えるのは
 * 「最終ゴール → 全体の道筋 → 今ここ → 今のフェーズの目的 → 次のステップ」の5つだけで、
 * 具体的な行動は「次回コーチングまでの目標」側（/coaching）で管理する。
 *
 * 【なぜ日付を出さないか】
 * 日・週単位の期限を並べると、コーチングで進め方が変わっただけで「遅れている」に見える。
 * ステージには期間を書かず、目安はサマリー帯の「次回見直し」だけに留める。
 */
import { Fragment } from 'react';
import { PlanStage } from '../../types/learningPlan';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';

const NODE_SIZE = 56;

/** ステージの並び順に対応するアイコン。意味は「学ぶ → 作る → 見せる → 挑む」 */
function StageIcon({ index, total, stroke }: { index: number; total: number; stroke: string }) {
  const base = {
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  // 最後のノートは常にゴール（旗）。手前は 学ぶ→作る→見せる の順で割り当てる
  if (index === total - 1) {
    return (
      <svg {...base}>
        <path d="M5.5 21V4M5.5 5h11l-2 3.5 2 3.5h-11" />
      </svg>
    );
  }
  if (index === 0) {
    return (
      <svg {...base}>
        <path d="M4 5.5A2 2 0 0 1 6 4h5v15H6a2 2 0 0 0-2 1.5z" />
        <path d="M20 5.5A2 2 0 0 0 18 4h-5v15h5a2 2 0 0 1 2 1.5z" />
      </svg>
    );
  }
  if (index === 1) {
    return (
      <svg {...base}>
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
        <path d="M14.5 5.5l3 3" />
      </svg>
    );
  }
  return (
    <svg {...base}>
      <path d="M21 4 10.5 14.5" />
      <path d="M21 4l-6.5 17-4-7.5L3 9.5z" />
    </svg>
  );
}

/** ノード間の矢印。到達済みは実線＋ブランド色、未到達は破線＋グレー */
function Connector({ reached }: { reached: boolean }) {
  return (
    <div
      aria-hidden
      style={{
        flex: '1 1 0',
        minWidth: 18,
        display: 'flex',
        alignItems: 'center',
        // 円の中心（ノード上端から NODE_SIZE/2）に矢印を合わせる
        marginTop: NODE_SIZE / 2 - 1,
        alignSelf: 'flex-start',
      }}
    >
      <span
        style={{
          flex: 1,
          height: 0,
          borderTop: reached ? `2px solid ${color.primary}` : `2px dashed ${color.trackBg}`,
        }}
      />
      <span
        style={{
          width: 0,
          height: 0,
          borderTop: '5px solid transparent',
          borderBottom: '5px solid transparent',
          borderLeft: `7px solid ${reached ? color.primary : color.trackBg}`,
        }}
      />
    </div>
  );
}

function Node({ stage, index, total }: { stage: PlanStage; index: number; total: number }) {
  const isCurrent = stage.status === 'current';
  const isDone = stage.status === 'done';
  const isGoal = index === total - 1;

  const circle = isCurrent
    ? { background: color.primary, border: 'none', boxShadow: shadow.currentStep }
    : isDone
      ? { background: color.surface, border: `2px solid ${color.primaryBorder}`, boxShadow: 'none' }
      : isGoal
        ? { background: color.goalBg, border: `2px solid ${color.goalBorder}`, boxShadow: 'none' }
        : { background: color.stepFutureBg, border: `2px solid ${color.borderNeutral}`, boxShadow: 'none' };

  const iconStroke = isCurrent
    ? color.textOnPrimary
    : isDone
      ? color.primary
      : isGoal
        ? color.goalText
        : color.stepFutureIcon;

  return (
    <div
      style={{
        flex: '0 1 auto',
        minWidth: 0,
        maxWidth: 190,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        textAlign: 'center',
      }}
    >
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        {isCurrent && (
          <span
            style={{
              position: 'absolute',
              top: -26,
              ...font.chip,
              background: color.primary,
              color: color.textOnPrimary,
              borderRadius: radius.pill,
              padding: '4px 12px',
              whiteSpace: 'nowrap',
            }}
          >
            いまここ
          </span>
        )}
        <span
          style={{
            width: NODE_SIZE,
            height: NODE_SIZE,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            boxSizing: 'border-box',
            ...circle,
          }}
        >
          <StageIcon index={index} total={total} stroke={iconStroke} />
        </span>
      </div>

      <span
        style={{
          ...font.caption,
          fontWeight: 700,
          color: isCurrent ? color.primary : isGoal ? color.goalText : color.textFaint,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {index + 1}
      </span>

      <span style={{ ...font.rowTitle, fontSize: 14.5, color: color.text }}>{stage.title}</span>

      {/* 目的を1行。何をする段なのかが分からないまま丸められるのを防ぐ */}
      <span style={{ ...font.caption, color: color.textMuted, lineHeight: 1.75 }}>{stage.note}</span>
    </div>
  );
}

interface PhaseJourneyProps {
  stages: PlanStage[];
}

export function PhaseJourney({ stages }: PhaseJourneyProps) {
  if (stages.length === 0) return null;

  // 現在ステージまでの矢印を実線にする。現在が見つからなければ（全完了）すべて実線
  const currentIndex = stages.findIndex((s) => s.status === 'current');
  const reachedUpTo = currentIndex < 0 ? stages.length : currentIndex;

  return (
    <section
      style={{
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.card,
        boxShadow: shadow.card,
        padding: '46px 32px 30px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        {stages.map((stage, i) => (
          <Fragment key={stage.key}>
            <Node stage={stage} index={i} total={stages.length} />
            {i < stages.length - 1 && <Connector reached={i < reachedUpTo} />}
          </Fragment>
        ))}
      </div>
    </section>
  );
}

export default PhaseJourney;
