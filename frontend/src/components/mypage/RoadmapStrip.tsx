/**
 * frontend/src/components/mypage/RoadmapStrip.tsx
 * マイページ上部の横型ロードマップ帯（claude.ai/design『マイページ 3d.dc.html』準拠）。
 *
 * 器だけを持ち、道のりの描画は RoadmapRail、5ステップへの束ねは
 * utils/learningPlanTemplate.ts の deriveRoadmapSteps に任せる。
 *
 * 🔴 以前の RoadmapSection（最下部の大きな帯）を置き換えたもの。
 *    「いまやっていること／この後のステップ」の2枚組はここには持たない。
 *    デザインが帯を1行に圧縮しており、内訳は /learning-plan 側で読めるため。
 */
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Map } from 'lucide-react';
import { useLearningPlan } from '../../hooks/useLearningPlan';
import { deriveRoadmapSteps } from '../../utils/learningPlanTemplate';
import RoadmapRail from './RoadmapRail';

interface RoadmapStripProps {
  userId: number | undefined;
}

const CARD: React.CSSProperties = {
  background: 'var(--dc-surface)',
  border: '1px solid var(--dc-border)',
  borderRadius: 'var(--dc-radius-lg)',
  boxShadow: 'var(--dc-shadow-card)',
};

/** 縦罫。カードの高さいっぱいに伸ばす */
function VRule() {
  return <div aria-hidden="true" style={{ width: 1, alignSelf: 'stretch', background: 'var(--dc-rule)', flex: 'none' }} />;
}

function DetailLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        flex: 'none',
        border: 0,
        background: 'transparent',
        padding: 0,
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 700,
        color: 'var(--dc-primary)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
      <ChevronRight size={15} strokeWidth={2} />
    </button>
  );
}

function RoadmapStrip({ userId }: RoadmapStripProps) {
  const navigate = useNavigate();
  // 🔴 checkinDue / pendingRevisionCount はここでは使わない。
  //    月次チェックインと更新案の案内はレビューでこの帯から外した（デザインにも無い）。
  //    どちらも /learning-plan 側で確認できる。
  const { plan, loading } = useLearningPlan(userId);

  if (loading) return null;

  // ---- 未作成: 初回設定への導線だけを出す ----
  if (!plan) {
    return (
      <section
        style={{
          ...CARD,
          padding: '16px 22px',
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          flexWrap: 'wrap',
          marginBottom: 22,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 auto', minWidth: 0 }}>
          <span
            style={{ width: 38, height: 38, flex: 'none', borderRadius: 'var(--dc-radius-md)', background: 'var(--dc-soft-100)', display: 'grid', placeItems: 'center' }}
          >
            <Map size={19} strokeWidth={1.75} color="var(--dc-primary)" />
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--dc-text)' }}>学習ロードマップ</span>
            <span style={{ fontSize: 12, color: 'var(--dc-text-muted)' }}>
              8つの質問に答えると、目標から逆算した学習計画をLMSが作成します。
            </span>
          </span>
        </span>
        <DetailLink label="ロードマップをつくる（約3分）" onClick={() => navigate('/learning-plan/setup')} />
      </section>
    );
  }

  const steps = deriveRoadmapSteps(plan, new Date());
  const currentPos = steps.findIndex((s) => s.status === 'current');
  // 「N / M ステップ」の N。current が無いときは達成ずみの数で代用する
  const stepNo = currentPos >= 0 ? currentPos + 1 : steps.filter((s) => s.status === 'done').length;

  return (
    <section style={{ ...CARD, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 18, marginBottom: 22 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 'none', width: 190 }}>
        <span
          style={{ width: 38, height: 38, flex: 'none', borderRadius: 'var(--dc-radius-md)', background: 'var(--dc-soft-100)', display: 'grid', placeItems: 'center' }}
        >
          <Map size={19} strokeWidth={1.75} color="var(--dc-primary)" />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--dc-text)', whiteSpace: 'nowrap' }}>学習ロードマップ</span>
          <span
            title={plan.goal}
            style={{ fontSize: 12, color: 'var(--dc-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            目標：{plan.goal}
          </span>
        </span>
      </span>

      <VRule />

      {/* レールは横幅があるほど読めるので、中央を伸ばす。上の余白は「いまここ」バッジぶん */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative', padding: '22px 8px 0' }}>
        <span className="dc-num" style={{ position: 'absolute', top: 0, right: 8, fontSize: 11 }}>
          <span style={{ color: 'var(--dc-primary)', fontWeight: 700 }}>{stepNo}</span>
          <span style={{ color: 'var(--dc-text-subtle)' }}> / {steps.length} ステップ</span>
        </span>
        <RoadmapRail steps={steps} />
      </div>

      <VRule />

      <DetailLink label="詳細を見る" onClick={() => navigate('/learning-plan')} />
    </section>
  );
}

export default RoadmapStrip;
