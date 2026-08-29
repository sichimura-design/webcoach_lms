/**
 * frontend/src/components/mypage/RoadmapRail.tsx
 * マイページのロードマップ帯に出す横一本道。
 *
 * 【なぜ learningPlan/StageRail と別なのか】
 * StageRail（/learning-plan）は4ステージ＋期間＋ステータスチップ＋内訳を出す「本編」の表示。
 * こちらは帯なので、ステップ名だけに絞る。データの出どころは同じ LearningPlan で、
 * 5ステップへの束ね方は utils/learningPlanTemplate.ts の deriveRoadmapSteps が唯一の実装。
 *
 * 🔴 レールは背景画像ではなく CSS で描く。ステップ数は受講生の回答で変わる
 *    （案件獲得まで進まない場合は3つになる）ため、画像では追随できない。
 *
 * 🔴 ノード列は flex:none（内容幅）、コネクタは flex:1。
 *    デザイン（マイページ 3d.dc.html）は列幅を 76/96/110/86/96px と
 *    ラベルの文字数に合わせて直接指定しているが、ステップ名は受講生の目標で変わるので
 *    固定値は置けない。内容幅 + 伸びるコネクタで同じ見た目にしている。
 */
import { Check, Flag } from 'lucide-react';
import type { RoadmapStepView } from '../../utils/learningPlanTemplate';

/** ノードの直径。デザインの実測値 */
const NODE = 32;

interface RoadmapRailProps {
  steps: RoadmapStepView[];
}

function StepNode({ step, index }: { step: RoadmapStepView; index: number }) {
  const base = {
    width: NODE,
    height: NODE,
    borderRadius: '50%',
    boxSizing: 'border-box' as const,
    display: 'grid',
    placeItems: 'center',
    // コネクタより前に出して、線がノードの下に潜るようにする
    position: 'relative' as const,
    zIndex: 1,
  };

  if (step.isGoal) {
    return (
      <span style={{ ...base, background: 'var(--dc-idle-surface)', border: '1px solid var(--dc-idle-border)' }}>
        <Flag size={14} strokeWidth={1.75} color="var(--dc-gold-border)" />
      </span>
    );
  }

  if (step.status === 'done') {
    return (
      <span style={{ ...base, background: 'var(--dc-tint-50)', border: '1px solid var(--dc-soft-200)' }}>
        <Check size={14} strokeWidth={2} color="var(--dc-primary)" />
      </span>
    );
  }

  if (step.status === 'current') {
    return (
      <span
        className="dc-num"
        style={{ ...base, background: 'var(--dc-primary)', color: '#fff', fontSize: 13, fontWeight: 700 }}
      >
        {index + 1}
      </span>
    );
  }

  return (
    <span
      className="dc-num"
      style={{
        ...base,
        background: 'var(--dc-idle-surface)',
        border: '1px solid var(--dc-idle-border)',
        color: 'var(--dc-idle-text)',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {index + 1}
    </span>
  );
}

/** ノード間をつなぐ線。通過ずみは実線（赤の淡色）、未通過は破線 */
function Connector({ passed }: { passed: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={
        passed
          ? { flex: 1, height: 2, borderRadius: 9999, background: 'var(--dc-soft-200)', margin: `${NODE / 2}px -14px 0` }
          : { flex: 1, height: 0, borderTop: '2px dashed var(--dc-rule)', margin: `${NODE / 2 + 1}px -14px 0` }
      }
    />
  );
}

function RoadmapRail({ steps }: RoadmapRailProps) {
  const n = steps.length;
  if (n === 0) return null;

  const currentPos = steps.findIndex((s) => s.status === 'current');
  // current が無いとき（全部done）は最後まで実線にする
  const passedUpTo = currentPos < 0 ? (steps.every((s) => s.status === 'done') ? n - 1 : 0) : currentPos;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start' }}>
      {steps.map((step, i) => (
        <div key={step.key} style={{ display: 'contents' }}>
          {i > 0 && <Connector passed={i <= passedUpTo} />}
          <span
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              flex: 'none',
              padding: '0 8px',
              position: 'relative',
            }}
          >
            {/* 「いまここ」はノードの真上（DESIGN.md §13 でラベルはひらがな固定） */}
            {step.status === 'current' && (
              <span style={{ position: 'absolute', top: -23, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span
                  style={{
                    background: 'var(--dc-primary)',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: 9999,
                    padding: '2px 10px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  いまここ
                </span>
                <span
                  aria-hidden="true"
                  style={{
                    width: 0,
                    height: 0,
                    borderLeft: '4px solid transparent',
                    borderRight: '4px solid transparent',
                    borderTop: '5px solid var(--dc-primary)',
                  }}
                />
              </span>
            )}

            <StepNode step={step} index={i} />

            <span
              style={{
                fontSize: 12,
                fontWeight: step.status === 'current' ? 700 : 500,
                color:
                  step.status === 'current'
                    ? 'var(--dc-primary)'
                    : step.status === 'done'
                    ? 'var(--dc-text-muted)'
                    : 'var(--dc-text-subtle)',
                whiteSpace: 'nowrap',
              }}
            >
              {step.title}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

export default RoadmapRail;
