/**
 * frontend/src/components/mypage/RoadmapSection.tsx
 * マイページ最下部の帯。長期学習ロードマップ（LearningPlan）の要約を出す。
 *
 * 以前はモック専用の journey（コース6ステップ固定）を表示していたが、
 * 期間・期限・達成条件・見直し日を持つ LearningPlan に置き換えた。
 * 横一本道のレール表現は PhaseTimeline に切り出して踏襲している。
 */
import { useNavigate } from 'react-router-dom';
import { useLearningPlan } from '../../hooks/useLearningPlan';
import { PLAN_STATUS_LABEL } from '../../types/learningPlan';
import { diffDays, formatJpDate, toIso } from '../../utils/learningPlanTemplate';
import { color, radius, shadow, font, t } from '../../theme/webcoachTheme';
import PhaseTimeline from '../learningPlan/PhaseTimeline';
import MilestoneRow from '../learningPlan/MilestoneRow';
import { ArrowRightIcon } from './ContinueLearningHero';

interface RoadmapSectionProps {
  userId: number | undefined;
}

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    </svg>
  );
}

const CARD_STYLE = {
  background: color.surface,
  border: `1px solid ${color.border}`,
  borderRadius: radius.card,
  boxShadow: shadow.card,
  padding: '24px 28px 30px',
} as const;

function RoadmapSection({ userId }: RoadmapSectionProps) {
  const navigate = useNavigate();
  const { plan, phaseStatuses, currentPhase, monthMilestones, checkinDue, pendingRevisionCount, loading } =
    useLearningPlan(userId);

  if (loading) return null;

  // ---- 未作成: 初回設定への導線だけを出す ----
  if (!plan) {
    return (
      <section style={CARD_STYLE}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div style={{ ...font.sectionTitle, color: color.text }}>学習ロードマップ</div>
            <div style={{ fontSize: 12.5, color: color.textSubtle, marginTop: 7, lineHeight: 1.7 }}>
              8つの質問に答えると、目標から逆算した半年〜1年の学習計画をLMSが作成します。
              <br />
              作成した内容は、次回のコーチングでコーチと一緒に調整できます。
            </div>
          </div>
          <button type="button" onClick={() => navigate('/learning-plan/setup')} style={{ ...t.primaryButton }}>
            <span>ロードマップをつくる（約3分）</span>
            <ArrowRightIcon />
          </button>
        </div>
      </section>
    );
  }

  const remainingDays = diffDays(toIso(new Date()), plan.goalDeadline);
  const remainingLabel =
    remainingDays <= 0
      ? '目標期限を過ぎています'
      : remainingDays < 45
        ? `残り${remainingDays}日`
        : `残り約${Math.round(remainingDays / 30)}ヶ月`;

  return (
    <section style={CARD_STYLE}>
      {/* 月次チェックイン・更新候補の帯。無視しても下の内容は普通に読める。 */}
      {(checkinDue || pendingRevisionCount > 0) && (
        <div
          onClick={() => navigate('/learning-plan')}
          role="button"
          tabIndex={0}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer',
            background: color.primarySoft, borderRadius: radius.md, padding: '11px 16px',
          }}
        >
          <SparkIcon />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: color.primary }}>
            {checkinDue
              ? '次回コーチングの前に（約1分）— 今月のふりかえりに答える'
              : `予定と実績に差があります・${pendingRevisionCount}件の更新候補があります`}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex' }}>
            <ArrowRightIcon size={14} stroke={color.primary} />
          </span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...font.sectionTitle, color: color.text }}>学習ロードマップ</span>
            {plan.status !== 'confirmed_with_coach' && (
              <span style={{ ...t.chip }}>{PLAN_STATUS_LABEL[plan.status]}</span>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: color.textSubtle, marginTop: 7 }}>
            {plan.goal}・{formatJpDateFullShort(plan.goalDeadline)}まで（{remainingLabel}）
            {currentPhase ? `・いまは「${currentPhase.title}」` : ''}
          </div>
        </div>
        <div
          onClick={() => navigate('/learning-plan')}
          role="button"
          tabIndex={0}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 700, color: color.primary, cursor: 'pointer', paddingTop: 4, whiteSpace: 'nowrap' }}
        >
          <span>全体をみる</span>
          <ArrowRightIcon size={14} stroke={color.primary} />
        </div>
      </div>

      <PhaseTimeline
        phases={plan.phases}
        statuses={phaseStatuses}
        mode="rail"
        avatarSrc={`${process.env.PUBLIC_URL}/images/home/avatar-user.png`}
      />

      {/* 今月のマイルストーンと次回見直し日。必須項目なので常に何かを出す。 */}
      <div style={{ marginTop: 30, paddingTop: 22, borderTop: `1px solid ${color.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ ...font.rowTitle, color: color.textStrong }}>今月のマイルストーン</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: color.textSubtle }}>
            次回見直し予定 {formatJpDate(plan.nextReviewDate)}
          </span>
        </div>

        {monthMilestones.length === 0 ? (
          <p style={{ fontSize: 13, color: color.textSubtle, marginTop: 14 }}>
            今月のマイルストーンはまだ設定されていません。次回のコーチングで一緒に決めましょう。
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            {monthMilestones.slice(0, 2).map((m) => (
              <MilestoneRow key={m.id} milestone={m} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** '2026-12-31' → '2026年12月' （帯では日まで出すと情報過多になる） */
function formatJpDateFullShort(iso: string): string {
  const [y, m] = iso.split('-');
  return `${Number(y)}年${Number(m)}月`;
}

export default RoadmapSection;
