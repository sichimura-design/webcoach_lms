/**
 * frontend/src/components/learningPlan/PhaseTimeline.tsx
 * フェーズの並びを描く共通パーツ。3箇所で使い回す。
 *   - 'rail'  : マイページの横一本道／プラン画面の全体表示
 *   - 'gantt' : 編集モード（コーチと画面共有しながら期間を調整する）
 *
 * デザイントークンは theme/webcoachTheme.ts のみを参照する（docs/design-token-spec.md）。
 */
import { CSSProperties } from 'react';
import { PhaseProgressStatus, PlanPhase } from '../../types/learningPlan';
import { diffDays, formatJpDate, parseIso } from '../../utils/learningPlanTemplate';
import { color, font, radius, shadow } from '../../theme/webcoachTheme';

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

interface PhaseTimelineProps {
  phases: PlanPhase[];
  statuses: PhaseProgressStatus[];
  mode?: 'rail' | 'gantt';
  /** rail のとき、現在フェーズの丸にこの画像を入れる（マイページのアバター表現） */
  avatarSrc?: string;
  onSelectPhase?: (phase: PlanPhase) => void;
}

// ============================================================
// rail: 横一本道
// ============================================================

function Rail({ phases, statuses, avatarSrc, onSelectPhase }: PhaseTimelineProps) {
  const n = phases.length;
  if (n === 0) return null;

  // 端のノードは列の中央にあるので、レールの左右を半列分だけ内側に寄せる
  const inset = 100 / (n * 2);
  const span = 100 - inset * 2;
  const doneCount = statuses.filter((s) => s === 'done').length;
  const progressFraction = n > 1 ? doneCount / (n - 1) : 0;

  return (
    <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, alignItems: 'start', marginTop: 34 }}>
      <div style={{ position: 'absolute', left: `${inset}%`, right: `${inset}%`, top: 13, height: 3, background: color.trackBg, borderRadius: 2 }} />
      <div style={{ position: 'absolute', left: `${inset}%`, width: `${span * progressFraction}%`, top: 13, height: 3, background: color.primary, borderRadius: 2 }} />

      {phases.map((phase, i) => {
        const status = statuses[i] ?? 'todo';
        const isCurrent = status === 'current';
        return (
          <div
            key={phase.key + phase.startDate}
            onClick={onSelectPhase ? () => onSelectPhase(phase) : undefined}
            style={{
              position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 12, cursor: onSelectPhase ? 'pointer' : undefined,
            }}
          >
            {isCurrent && (
              <div style={{ position: 'absolute', top: -40, left: 'calc(50% + 22px)', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: color.primary, background: color.primarySoft, borderRadius: 999, padding: '5px 12px', whiteSpace: 'nowrap' }}>
                  いまここ
                </span>
              </div>
            )}

            {status === 'done' ? (
              <span style={{ width: 29, height: 29, borderRadius: '50%', background: color.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: shadow.stepRing }}>
                <CheckIcon />
              </span>
            ) : isCurrent ? (
              <span style={{ width: 33, height: 33, borderRadius: '50%', background: color.surface, border: `3px solid ${color.primary}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: shadow.currentStep, marginTop: -2 }}>
                {avatarSrc ? (
                  <img src={avatarSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: color.primary }}>{i + 1}</span>
                )}
              </span>
            ) : (
              <span style={{ width: 29, height: 29, borderRadius: '50%', background: color.surface, border: `2px solid ${color.borderNeutral}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700, color: color.textSubtle, boxShadow: shadow.stepRing }}>
                {i + 1}
              </span>
            )}

            <span style={{ fontSize: 12.5, fontWeight: isCurrent ? 700 : 500, textAlign: 'center', lineHeight: 1.35, color: isCurrent ? color.primary : status === 'done' ? color.textSecondary : color.textSubtle }}>
              {phase.title}
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, color: color.textFaint }}>
              {formatJpDate(phase.startDate)}〜
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// gantt: 月目盛り付きの横棒
// ============================================================

/** 期間全体をまたぐ月の区切りを作る（目盛り用） */
function monthTicks(startIso: string, endIso: string): { label: string; fraction: number }[] {
  const total = Math.max(1, diffDays(startIso, endIso));
  const ticks: { label: string; fraction: number }[] = [];
  const cursor = parseIso(startIso);
  cursor.setDate(1);
  // 開始月の1日は範囲外なので次の月から
  cursor.setMonth(cursor.getMonth() + 1);
  const end = parseIso(endIso);
  while (cursor <= end) {
    const offset = Math.round((cursor.getTime() - parseIso(startIso).getTime()) / 86400000);
    ticks.push({ label: `${cursor.getMonth() + 1}月`, fraction: offset / total });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return ticks;
}

const BAR_LABEL_WIDTH = 132;

function Gantt({ phases, statuses }: PhaseTimelineProps) {
  if (phases.length === 0) return null;
  const rangeStart = phases[0].startDate;
  const rangeEnd = phases[phases.length - 1].endDate;
  const total = Math.max(1, diffDays(rangeStart, rangeEnd));
  const ticks = monthTicks(rangeStart, rangeEnd);

  const trackStyle: CSSProperties = { position: 'relative', flex: 1, height: 22 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {phases.map((phase, i) => {
        const status = statuses[i] ?? 'todo';
        const left = (diffDays(rangeStart, phase.startDate) / total) * 100;
        const width = Math.max(1.5, (diffDays(phase.startDate, phase.endDate) / total) * 100);
        return (
          <div key={phase.key + phase.startDate} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: BAR_LABEL_WIDTH, flex: `0 0 ${BAR_LABEL_WIDTH}px`, fontSize: 12.5, fontWeight: status === 'current' ? 700 : 500, color: status === 'current' ? color.primary : color.textSecondary }}>
              {phase.title}
            </span>
            <div style={trackStyle}>
              {/* 月の縦罫 */}
              {ticks.map((t) => (
                <span key={t.label + t.fraction} style={{ position: 'absolute', left: `${t.fraction * 100}%`, top: 0, bottom: 0, width: 1, background: color.divider }} />
              ))}
              <span
                style={{
                  position: 'absolute', left: `${left}%`, width: `${width}%`, top: 4, height: 14,
                  borderRadius: radius.pill,
                  background: status === 'done' ? color.primarySoft : status === 'current' ? color.primary : color.trackBg,
                  border: status === 'done' ? `1px solid ${color.primaryBorder}` : 'none',
                }}
              />
            </div>
          </div>
        );
      })}

      {/* 月目盛り */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 2 }}>
        <span style={{ width: BAR_LABEL_WIDTH, flex: `0 0 ${BAR_LABEL_WIDTH}px` }} />
        <div style={{ position: 'relative', flex: 1, height: 16 }}>
          <span style={{ position: 'absolute', left: 0, fontSize: 11, color: color.textFaint }}>{formatJpDate(rangeStart)}</span>
          {ticks.map((t) => (
            <span key={`lbl-${t.label}-${t.fraction}`} style={{ position: 'absolute', left: `${t.fraction * 100}%`, transform: 'translateX(-50%)', fontSize: 11, color: color.textFaint }}>
              {t.label}
            </span>
          ))}
          <span style={{ position: 'absolute', right: 0, fontSize: 11, color: color.textFaint }}>{formatJpDate(rangeEnd)}</span>
        </div>
      </div>
    </div>
  );
}

function PhaseTimeline(props: PhaseTimelineProps) {
  return props.mode === 'gantt' ? <Gantt {...props} /> : <Rail {...props} />;
}

export default PhaseTimeline;

/** フェーズ見出しの横に添える期間チップ。プラン画面と編集モードで共用する。 */
export function PhaseRangeChip({ phase }: { phase: PlanPhase }) {
  const weeks = Math.max(1, Math.round(diffDays(phase.startDate, phase.endDate) / 7));
  return (
    <span style={{ ...font.caption, color: color.textSubtle }}>
      {formatJpDate(phase.startDate)} 〜 {formatJpDate(phase.endDate)}（約{weeks}週間）
    </span>
  );
}
