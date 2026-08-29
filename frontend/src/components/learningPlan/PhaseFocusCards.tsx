/**
 * frontend/src/components/learningPlan/PhaseFocusCards.tsx
 * 「いまやっていること」と「この後のステップ」。
 *
 * ThisMonthCard.tsx（今月やること＝マイルストーンのチェックリスト）の置き換え。
 * 「今月のマイルストーンとかは確実に要らない」「細かなTodoではなく目的・状態を
 * 表す粗い粒度で」というレビュー指摘に沿って、
 * チェックリストを持たず、いまの段の目的と次の段の目的を1行ずつ出すだけにする。
 *
 * 具体的な行動は /coaching の「次回までのアクション」が持つ。
 * ロードマップ側に持たせると役割が混ざって運用が複雑になる。
 */
import { PlanStage } from '../../types/learningPlan';
import { color, font, radius } from '../../theme/webcoachTheme';

interface PhaseFocusCardsProps {
  stages: PlanStage[];
}

function TargetIcon({ stroke }: { stroke: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 12 20.5 3.5" />
    </svg>
  );
}

function TrendIcon({ stroke }: { stroke: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 16.5 9 10.5l3.5 3.5L20.5 6" />
      <path d="M15.5 6h5v5" />
    </svg>
  );
}

function Card({
  icon,
  label,
  title,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  note: string;
  tone: { bg: string; border: string; fg: string; iconBg: string };
}) {
  return (
    <div
      style={{
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        borderRadius: radius.card,
        padding: '24px 26px',
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
        height: '100%',
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: tone.iconBg,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...font.cardTitle, color: tone.fg }}>{label}</div>
        <div style={{ ...font.rowTitle, fontSize: 15.5, color: color.text, marginTop: 10, lineHeight: 1.6 }}>
          {title}
        </div>
        <p style={{ ...font.caption, color: color.textMuted, margin: '8px 0 0', lineHeight: 1.9 }}>{note}</p>
      </div>
    </div>
  );
}

export function PhaseFocusCards({ stages }: PhaseFocusCardsProps) {
  const currentIndex = stages.findIndex((s) => s.status === 'current');
  const current = currentIndex >= 0 ? stages[currentIndex] : null;
  const next = currentIndex >= 0 ? stages[currentIndex + 1] ?? null : null;

  if (!current) return null;

  return (
    <div className="plan-focus-2col">
      <Card
        icon={<TargetIcon stroke={color.primary} />}
        label="いまやっていること"
        title={current.title}
        note={`${current.note}に取り組む段です。小さな積み重ねが、次の段の土台になります。`}
        tone={{
          bg: color.hoverBgTint,
          border: color.primaryBorderSoft,
          fg: color.primary,
          iconBg: color.primarySoft,
        }}
      />

      {next ? (
        <Card
          icon={<TrendIcon stroke={color.goalText} />}
          label="この後のステップ"
          title={next.title}
          note={`次は${next.note}へ。いま急ぐ必要はありません。この段を終えたら自然に入っていけます。`}
          tone={{
            bg: color.goalBg,
            border: color.goalBorder,
            fg: color.goalText,
            iconBg: '#FBEFD8',
          }}
        />
      ) : (
        <Card
          icon={<TrendIcon stroke={color.goalText} />}
          label="この後のステップ"
          title="最終ゴールの段まで来ています"
          note="ここまでの積み重ねを実際の案件で試す段です。うまくいかない日があっても、それも含めて経験になります。"
          tone={{
            bg: color.goalBg,
            border: color.goalBorder,
            fg: color.goalText,
            iconBg: '#FBEFD8',
          }}
        />
      )}
    </div>
  );
}

export default PhaseFocusCards;
