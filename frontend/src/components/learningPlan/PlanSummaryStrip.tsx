/**
 * frontend/src/components/learningPlan/PlanSummaryStrip.tsx
 * ロードマップ画面の一番上に置く3タイル。
 *   最終ゴール / 現在地 / 次回見直し
 *
 * 【なぜ「進み具合 ◯%」を出さないか】
 * 以前は4タイル目に進捗リング（%）があった。ロードマップは半年〜1年の地図で、
 * 進み方はコーチングのたびに変わる。そこに%を出すと、計画どおりでも
 * 「数字が足りない」と読めてしまう。現在地はレール（PhaseJourney）の位置で足りる。
 * design-token-spec.md の「定量%指標を表示しない」方針とも揃う。
 *
 * 【なぜ日付をぼかすか】
 * 「期間も厳密な期限ではなく『7〜9月ごろ』『約2〜3か月』など目安として扱う」方針。
 * 「8月20日まで」と出すと1日ずれただけで遅れに見えるため、月・週の粒度に丸める。
 */
import { LearningPlan, PlanStage } from '../../types/learningPlan';
import { diffDays, toIso } from '../../utils/learningPlanTemplate';
import { color, font, radius, t } from '../../theme/webcoachTheme';

const TILE_MIN_WIDTH = 200;

function FlagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color.primary} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21V4M5 4h11l-1.6 3.5L16 11H5" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color.primary} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-6.1 7-11a7 7 0 10-14 0c0 4.9 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color.primary} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

/**
 * ゴール期限を「◯月ごろ」に丸める。
 * 月内なら「今月中」。半年以上先なら年も添えて、遠さが伝わるようにする。
 */
function fuzzyDeadline(deadlineIso: string, todayIso: string): string {
  const days = diffDays(todayIso, deadlineIso);
  if (days <= 0) return '期限を過ぎています';
  const d = new Date(deadlineIso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date(todayIso);
  const sameMonth = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (sameMonth) return '今月中が目安';
  const label = `${d.getMonth() + 1}月ごろが目安`;
  return d.getFullYear() !== now.getFullYear() ? `${d.getFullYear()}年${label}` : label;
}

/** 見直し日を「約N週間後」に丸める。過ぎていれば見直し時期として扱う */
function fuzzyReview(reviewIso: string, todayIso: string): string {
  const days = diffDays(todayIso, reviewIso);
  if (days <= 0) return '今日が見直し時期です';
  if (days <= 3) return '数日後に見直し';
  if (days <= 10) return '約1週間後に見直し';
  if (days <= 24) return `約${Math.round(days / 7)}〜${Math.round(days / 7) + 1}週間後に見直し`;
  return `約${Math.max(1, Math.round(days / 30))}か月後に見直し`;
}

function Tile({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: `1 1 ${TILE_MIN_WIDTH}px`, minWidth: TILE_MIN_WIDTH, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <span
        style={{
          width: 40, height: 40, flex: '0 0 40px', borderRadius: '50%', background: color.primarySoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...font.caption, color: color.textSubtle }}>{label}</div>
        <div style={{ marginTop: 6 }}>{children}</div>
      </div>
    </div>
  );
}

const VALUE_STYLE: React.CSSProperties = { fontSize: 14.5, fontWeight: 900, color: color.text, lineHeight: 1.55 };
const SUB_STYLE: React.CSSProperties = { ...font.caption, color: color.textMuted, marginTop: 5, lineHeight: 1.6 };

interface PlanSummaryStripProps {
  plan: LearningPlan;
  stages: PlanStage[];
  currentStage: PlanStage | null;
}

function PlanSummaryStrip({ plan, stages, currentStage }: PlanSummaryStripProps) {
  const today = toIso(new Date());
  const stagePos = currentStage ? stages.findIndex((s) => s.key === currentStage.key) + 1 : 0;

  return (
    <section style={{ ...t.card, padding: '24px 28px', display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <Tile icon={<FlagIcon />} label="最終ゴール">
        <div style={VALUE_STYLE}>{plan.goal}</div>
        <div style={SUB_STYLE}>{fuzzyDeadline(plan.goalDeadline, today)}</div>
      </Tile>

      <Tile icon={<PinIcon />} label="現在地">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={VALUE_STYLE}>{currentStage?.title ?? '—'}</span>
        </div>
        <div style={SUB_STYLE}>
          {stagePos > 0 ? `${stagePos} / ${stages.length} ステップ` : '—'}
        </div>
      </Tile>

      <Tile icon={<CalendarIcon />} label="次回見直し">
        <div style={VALUE_STYLE}>{fuzzyReview(plan.nextReviewDate, today)}</div>
        <div style={SUB_STYLE}>進み方に合わせて調整できます</div>
      </Tile>
    </section>
  );
}

export default PlanSummaryStrip;
