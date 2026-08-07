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
import { color, radius, shadow, font, t } from '../../theme/webcoachTheme';
import StageRail from '../learningPlan/StageRail';
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
  const { plan, stages, currentStage, currentPhase, checkinDue, pendingRevisionCount, loading } =
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

  // いま何をしていて、この後どこへ向かうか。ここだけ言えれば帯としては十分。
  const currentStageIndex = stages.findIndex((s) => s.status === 'current');
  const nextStage = currentStageIndex >= 0 ? stages[currentStageIndex + 1] : stages[0];

  return (
    <section style={CARD_STYLE}>
      {/*
        月次チェックインの案内。無視しても下の内容は普通に読める。
        🔴 更新候補の帯にあった「予定と実績に差があります」は出さない。
           遅れを突きつけられて焦る、というレビュー指摘への対応。
           数を伝えるだけにして、判断はロードマップ画面でしてもらう。
      */}
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
              : `ロードマップの更新案が${pendingRevisionCount}件あります`}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex' }}>
            <ArrowRightIcon size={14} stroke={color.primary} />
          </span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ ...font.sectionTitle, color: color.text }}>
              {plan.goal}のための学習ロードマップ
            </span>
            {plan.status !== 'confirmed_with_coach' && (
              <span style={{ ...t.chip }}>{PLAN_STATUS_LABEL[plan.status]}</span>
            )}
          </div>
          {/*
            🔴 「残り◯日」「目標期限を過ぎています」は出さない。
               ロードマップは締切ではなく道順を示すもの、というレビュー指摘。
               期限そのものは /learning-plan で確認できる。
          */}
          <div style={{ fontSize: 12.5, color: color.textSubtle, marginTop: 7 }}>
            一歩ずつ進めば、必ず目標につながります。今日の積み重ねが、未来の実績に。
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

      {/*
        /learning-plan と同じ4ステージ表示に揃える。
        ここだけ7フェーズの点を並べると、ロードマップ画面で粒度を粗くした意味が薄れるため。
        内訳は本編（/learning-plan）側にだけ置く。
      */}
      <div style={{ marginTop: 32 }}>
        <StageRail stages={stages} currentStage={currentStage} showBreakdown={false} />
      </div>

      {/*
        🔴 ここは以前「今月のマイルストーン＋次回見直し予定」だった。
           帯の情報量が多すぎる／マイルストーンは要らない、というレビュー指摘で差し替え。
           代わりに、レールを見て次に知りたい2点だけを置く。
      */}
      <div style={{ display: 'flex', gap: 14, marginTop: 28, flexWrap: 'wrap' }}>
        <FocusCard
          label="いまやっていること"
          title={currentPhase?.title ?? currentStage?.title ?? 'これから始めます'}
          note={currentStage?.note ?? '小さな改善の積み重ねが、大きな自信になります。'}
        />
        <FocusCard
          label="この後のステップ"
          title={nextStage?.title ?? '目標の達成'}
          note={nextStage?.note ?? 'ここまで来たら、次の目標をコーチと決めましょう。'}
        />
      </div>
    </section>
  );
}

/** 「いまやっていること」「この後のステップ」の2枚組 */
function FocusCard({ label, title, note }: { label: string; title: string; note: string }) {
  return (
    <div
      style={{
        flex: '1 1 280px',
        minWidth: 0,
        background: color.hoverBgTint,
        border: `1px solid ${color.primaryBorderSoft}`,
        borderRadius: radius.md,
        padding: '16px 18px',
      }}
    >
      <div style={{ ...font.caption, color: color.primary, fontWeight: 900 }}>{label}</div>
      <div style={{ ...font.rowTitle, color: color.textStrong, marginTop: 7, lineHeight: 1.5 }}>{title}</div>
      <div style={{ ...font.caption, color: color.textSubtle, marginTop: 6, lineHeight: 1.7 }}>{note}</div>
    </div>
  );
}

export default RoadmapSection;
