/**
 * frontend/src/components/learningPlan/PlanSummaryStrip.tsx
 * ロードマップ画面の一番上に置く4タイル。
 *   最終ゴール / 現在地 / 進み具合 / 次回見直し
 *
 * 【「遅れてる感」を出さないための設計】
 * 元案にあった「完了したマイルストーン 4/14件」は出さない。
 * 分母が14あると、計画どおりに進んでいても常に「10件も残っている」と読めてしまう。
 * 代わりに、リングは全体1本の割合、添え字は「4ステージ中2つ目」に置き換えている。
 * 数え上げるのは今月のぶん（ThisMonthCard）だけで十分という判断。
 */
import { LearningPlan, PlanStage } from '../../types/learningPlan';
import { diffDays, formatJpDateFull, toIso } from '../../utils/learningPlanTemplate';
import { color, font, radius, t } from '../../theme/webcoachTheme';

const TILE_MIN_WIDTH = 190;

function FlagIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color.primary} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21V4M5 4h11l-1.6 3.5L16 11H5" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color.primary} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s7-6.1 7-11a7 7 0 10-14 0c0 4.9 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={color.primary} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

/** 進捗リング。数字より先に「どのくらい来たか」を面で伝える。 */
function ProgressRing({ value }: { value: number }) {
  const size = 54;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flex: `0 0 ${size}px` }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color.trackBg} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color.primary}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - value)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 500ms ease' }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ fontFamily: font.family, fontSize: 14, fontWeight: 900, fill: color.text }}
      >
        {Math.round(value * 100)}%
      </text>
    </svg>
  );
}

function Tile({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div style={{ flex: `1 1 ${TILE_MIN_WIDTH}px`, minWidth: TILE_MIN_WIDTH, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span
        style={{
          width: 36, height: 36, flex: '0 0 36px', borderRadius: radius.nav, background: color.primarySoft,
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

const VALUE_STYLE: React.CSSProperties = { fontSize: 14, fontWeight: 900, color: color.text, lineHeight: 1.5 };
const SUB_STYLE: React.CSSProperties = { ...font.caption, color: color.textMuted, marginTop: 5, lineHeight: 1.6 };

interface PlanSummaryStripProps {
  plan: LearningPlan;
  stages: PlanStage[];
  currentStage: PlanStage | null;
  currentPhaseTitle: string | null;
  progress: number;
}

function PlanSummaryStrip({ plan, stages, currentStage, currentPhaseTitle, progress }: PlanSummaryStripProps) {
  const today = toIso(new Date());
  const remaining = diffDays(today, plan.goalDeadline);
  const stagePos = currentStage ? stages.findIndex((s) => s.key === currentStage.key) + 1 : 0;

  // 進捗の一言。経過した期間の割合と実際の進捗を比べて出し分ける。
  // 遅れていても「遅れています」とは書かない ── 見直しの導線があることを伝えるほうが行動につながる。
  const start = plan.phases[0]?.startDate ?? today;
  const span = Math.max(1, diffDays(start, plan.goalDeadline));
  const elapsed = Math.min(1, Math.max(0, diffDays(start, today) / span));
  const progressNote =
    progress >= elapsed * 0.85
      ? 'いまのペースなら期限に間に合います'
      : '次回の見直しでペースを調整できます';

  return (
    <section style={{ ...t.card, padding: '22px 26px', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <Tile icon={<FlagIcon />} label="最終ゴール">
        <div style={VALUE_STYLE}>{plan.goal}</div>
        <div style={SUB_STYLE}>
          {formatJpDateFull(plan.goalDeadline)} まで
          {remaining > 0 && `・残り約${Math.max(1, Math.round(remaining / 7))}週間`}
        </div>
      </Tile>

      <Tile icon={<PinIcon />} label="現在地">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={VALUE_STYLE}>{currentStage?.title ?? '—'}</span>
          {currentStage && <span style={{ ...t.chip }}>いまここ</span>}
        </div>
        <div style={SUB_STYLE}>{currentPhaseTitle ?? currentStage?.note ?? '—'}</div>
      </Tile>

      <Tile icon={<ProgressRing value={progress} />} label="進み具合">
        <div style={VALUE_STYLE}>
          {stages.length}ステージ中 {stagePos || 1}つ目
        </div>
        <div style={SUB_STYLE}>{progressNote}</div>
      </Tile>

      <Tile icon={<CalendarIcon />} label="次回見直し">
        <div style={VALUE_STYLE}>{formatJpDateFull(plan.nextReviewDate)}</div>
        <div style={SUB_STYLE}>コーチと一緒に計画を見直しましょう</div>
      </Tile>
    </section>
  );
}

export default PlanSummaryStrip;
