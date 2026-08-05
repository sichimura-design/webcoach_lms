/**
 * frontend/src/components/learningPlan/MilestoneRow.tsx
 * マイルストーン1件の表示。
 *
 * 「何をするか ＋ どの状態になれば完了か ＋ いつまでに」を1文に整形して見せるのが要点で、
 * 「バナー制作を練習する」のような判定不能な書き方が画面に出ないようにしている。
 * 状態マーカーの表現は mypage/NextCoachingPlan.tsx の書式を踏襲する。
 */
import { Milestone } from '../../types/learningPlan';
import { formatMilestone, milestoneProgress } from '../../utils/learningPlanTemplate';
import { color, radius } from '../../theme/webcoachTheme';

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

interface MilestoneRowProps {
  milestone: Milestone;
  /** 進捗バーと実績値を出すか（マイページの要約表示では省く） */
  showMetric?: boolean;
  /** 右側に置く操作（編集モードの「文言を編集」「削除」など） */
  action?: React.ReactNode;
}

function MilestoneRow({ milestone, showMetric = true, action }: MilestoneRowProps) {
  const done = milestone.status === 'done';
  const missed = milestone.status === 'missed';
  const progress = milestoneProgress(milestone);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      {done ? (
        <span style={{ width: 24, height: 24, flex: '0 0 24px', marginTop: 1, borderRadius: '50%', background: color.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckIcon />
        </span>
      ) : milestone.status === 'in_progress' ? (
        <span style={{ width: 24, height: 24, flex: '0 0 24px', marginTop: 1, borderRadius: '50%', border: `2px solid ${color.textStrong}`, boxSizing: 'border-box' }} />
      ) : (
        <span style={{ width: 24, height: 24, flex: '0 0 24px', marginTop: 1, borderRadius: '50%', border: `2px dashed ${missed ? color.primary : color.primaryDashed}`, boxSizing: 'border-box' }} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.6, color: done ? color.textSubtle : color.textStrong }}>
          {formatMilestone(milestone)}
        </div>

        {showMetric && milestone.metric && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 7 }}>
            <div style={{ flex: 1, maxWidth: 220, height: 6, borderRadius: radius.pill, background: color.trackBg, overflow: 'hidden' }}>
              <div style={{ width: `${progress * 100}%`, height: '100%', background: color.primary, borderRadius: radius.pill, transition: 'width 400ms ease' }} />
            </div>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: color.textSubtle, whiteSpace: 'nowrap' }}>
              {milestone.metric.current} / {milestone.metric.target}
              {milestone.metric.unit}
            </span>
          </div>
        )}

        {showMetric && !milestone.metric && (
          <div style={{ fontSize: 11.5, fontWeight: 500, color: color.textFaint, marginTop: 6 }}>
            達成の判定は自己申告
          </div>
        )}

        {missed && (
          <div style={{ fontSize: 11.5, fontWeight: 700, color: color.primary, marginTop: 6 }}>期限を過ぎています</div>
        )}
      </div>

      {action && <div style={{ flex: '0 0 auto' }}>{action}</div>}
    </div>
  );
}

export default MilestoneRow;
