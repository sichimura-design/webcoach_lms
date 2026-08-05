/**
 * frontend/src/components/learningPlan/ThisMonthCard.tsx
 * 「今月やること」。この画面でいちばん行動につながるブロック。
 *
 * 計画全体の達成カウント（14件中4件…）は出さず、
 * **数え上げるのは今月ぶんだけ**にしている。分母が小さいほど手が出るため。
 * 残りのマイルストーンは畳んで置き、必要な人だけ開ける。
 */
import { useState } from 'react';
import { Milestone, MILESTONE_STATUS_LABEL, PlanPhase } from '../../types/learningPlan';
import { diffDays, formatJpDate, milestoneProgress, toIso } from '../../utils/learningPlanTemplate';
import { color, font, radius, t } from '../../theme/webcoachTheme';

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color.primary}
      strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color.textSubtle} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

const STATUS_STYLE: Record<Milestone['status'], { bg: string; fg: string }> = {
  done: { bg: color.hoverBg, fg: color.textSubtle },
  in_progress: { bg: color.primarySoft, fg: color.primary },
  todo: { bg: color.hoverBg, fg: color.textMuted },
  missed: { bg: color.primarySoft, fg: color.primary },
};

function MilestoneLine({ milestone, index }: { milestone: Milestone; index: number }) {
  const progress = milestoneProgress(milestone);
  const done = milestone.status === 'done';
  const chip = STATUS_STYLE[milestone.status];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 4px' }}>
      {done ? (
        <span
          style={{
            width: 24, height: 24, flex: '0 0 24px', borderRadius: '50%', background: color.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <CheckIcon />
        </span>
      ) : (
        <span
          style={{
            width: 24, height: 24, flex: '0 0 24px', borderRadius: '50%', boxSizing: 'border-box',
            background: color.primary, color: color.textOnPrimary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 900,
          }}
        >
          {index + 1}
        </span>
      )}

      <span
        style={{
          flex: '1 1 260px', minWidth: 200, fontSize: 13.5, fontWeight: 500, lineHeight: 1.6,
          color: done ? color.textSubtle : color.textStrong,
        }}
      >
        {formatJpDate(milestone.dueDate)}までに{milestone.actionRenyou ?? milestone.action}
      </span>

      {milestone.metric ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '0 1 210px', minWidth: 150 }}>
          <span style={{ flex: 1, height: 7, borderRadius: radius.pill, background: color.trackBg, overflow: 'hidden' }}>
            <span
              style={{
                display: 'block', width: `${progress * 100}%`, height: '100%',
                background: color.primary, borderRadius: radius.pill, transition: 'width 400ms ease',
              }}
            />
          </span>
          <span style={{ ...font.chip, color: progress > 0 ? color.primary : color.textFaint, whiteSpace: 'nowrap' }}>
            {milestone.metric.current} / {milestone.metric.target}
            {milestone.metric.unit}
          </span>
        </span>
      ) : (
        <span style={{ ...font.caption, color: color.textFaint, flex: '0 1 210px', minWidth: 150 }}>
          達成の判定は自己申告
        </span>
      )}

      <span
        style={{
          ...font.chip, borderRadius: radius.pill, padding: '5px 12px', whiteSpace: 'nowrap',
          background: chip.bg, color: chip.fg,
        }}
      >
        {MILESTONE_STATUS_LABEL[milestone.status]}
      </span>
    </div>
  );
}

interface ThisMonthCardProps {
  /** 今月ぶんとして先に見せるマイルストーン */
  milestones: Milestone[];
  /** 現在のフェーズ。見出しの期間表示に使う */
  phase: PlanPhase | null;
  /** 「すべてのタスクを確認する」で開く残り */
  restMilestones: Milestone[];
}

function ThisMonthCard({ milestones, phase, restMilestones }: ThisMonthCardProps) {
  const [expanded, setExpanded] = useState(false);
  const remainingWeeks = phase ? Math.max(0, Math.round(diffDays(toIso(new Date()), phase.endDate) / 7)) : 0;

  return (
    <section style={{ ...t.card, padding: '22px 26px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ ...font.cardTitle, color: color.text }}>今月やること</span>
        {phase && (
          <span style={{ ...font.caption, color: color.textSubtle }}>
            （{formatJpDate(phase.startDate)}〜{formatJpDate(phase.endDate)}：{phase.title}）
          </span>
        )}
        {phase && <span style={{ ...t.chip }}>いまここ</span>}

        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 7 }}>
          <CalendarIcon />
          <span style={{ ...font.caption, color: color.textMuted }}>
            このフェーズは残り <b style={{ color: color.text, fontWeight: 900 }}>{remainingWeeks}</b> 週間
          </span>
        </span>
      </div>

      {milestones.length === 0 ? (
        <p style={{ ...font.meta, color: color.textSubtle, margin: '18px 0 6px', lineHeight: 1.8 }}>
          今月のマイルストーンはまだ設定されていません。次回のコーチングで一緒に決めましょう。
        </p>
      ) : (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column' }}>
          {milestones.map((m, i) => (
            <div key={m.id} style={{ borderTop: i === 0 ? 'none' : `1px solid ${color.border}` }}>
              <MilestoneLine milestone={m} index={i} />
            </div>
          ))}

          {expanded &&
            restMilestones.map((m, i) => (
              <div key={m.id} style={{ borderTop: `1px solid ${color.border}` }}>
                <MilestoneLine milestone={m} index={milestones.length + i} />
              </div>
            ))}
        </div>
      )}

      {restMilestones.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', borderTop: `1px solid ${color.border}`, paddingTop: 12, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
              fontFamily: 'inherit', ...font.link, color: color.primary, cursor: 'pointer', padding: '6px 10px',
            }}
          >
            {expanded ? '閉じる' : `このフェーズの残り${restMilestones.length}件を確認する`}
            <ChevronIcon open={expanded} />
          </button>
        </div>
      )}
    </section>
  );
}

export default ThisMonthCard;
