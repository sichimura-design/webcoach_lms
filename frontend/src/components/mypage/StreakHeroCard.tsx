import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { StudyStatsSummary } from '../../types/studyActivity';

/**
 * 学習ストリーク（マイページ左上のヒーローカード）。
 * claude.ai/design『トップページ 3案』5a 準拠。
 *
 * 🔴 日数はログイン日数ではなく「実際に学習した日数」。
 *    集計は utils/studyStats.ts が唯一の実装で、学習記録ページとここが同じ値を見る。
 *
 * 🔴 このページで唯一の「祝う要素」（DESIGN.md §1-7「祝う要素は1画面に1つだけ」）。
 *    赤ベタの面もページ内で数えられているので、ここを増やすなら別のどこかを減らすこと。
 *
 * 🔴 CTAは置かない。塗りつぶしの赤ボタンはマイページでは
 *    「続きから学習する」（StudyChallengeCard）1つだけという対比を保つ。
 *    掘り下げは Quiet リンク「詳しく見る ›」→ /study-log に任せる。
 */
interface StreakHeroCardProps {
  stats: StudyStatsSummary | null;
  loading: boolean;
}

/** 2色の炎。lucide の Flame は単色なのでここだけインラインSVG（DESIGN.md §11 の例外） */
function FlameIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"
        fill="var(--dc-primary)"
      />
      <path
        d="M12 21a4 4 0 0 0 4-4c0-1.2-.6-2.3-1.5-3.2-.7 1-1.6 1.6-2.5 1.7-1 .1-2-.5-2.4-1.5-.9 1-1.6 2-1.6 3A4 4 0 0 0 12 21z"
        fill="#FDE8C5"
      />
    </svg>
  );
}

/** 半透明の白ピル。数字が入るので tabular-nums を効かせる */
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="dc-num"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(255,255,255,.16)',
        borderRadius: 9999,
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export function StreakHeroCard({ stats, loading }: StreakHeroCardProps) {
  const navigate = useNavigate();
  const streak = stats?.streak;
  const current = streak?.currentDays ?? 0;
  const best = Math.max(streak?.bestDays ?? 0, current);
  const isNewBest = current > 0 && current >= (streak?.bestDays ?? 0);
  const remain = Math.max(0, best - current);

  // 桁が増えても「日連続」とぶつからないように数字だけ縮める
  const numberSize = current >= 100 ? 42 : current >= 10 ? 52 : 62;

  return (
    <section
      style={{
        background: 'linear-gradient(135deg,#E00F36 0%,#C00A2C 60%,#A80B27 100%)',
        borderRadius: 'var(--dc-radius-lg)',
        boxShadow: '0 14px 28px -14px rgba(160,8,36,.55)',
        padding: '24px 26px',
        color: '#fff',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <span
          style={{
            width: 34,
            height: 34,
            flex: 'none',
            borderRadius: 9999,
            background: '#fff',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 2px 6px rgba(90,0,14,.3)',
          }}
        >
          <FlameIcon />
        </span>
        <h2 style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
          学習ストリーク
        </h2>
        <button
          type="button"
          onClick={() => navigate('/study-log')}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            border: 0,
            background: 'transparent',
            padding: 0,
            fontFamily: 'inherit',
            fontSize: 12,
            fontWeight: 600,
            color: '#fff',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          詳しく見る
          <ChevronRight size={14} strokeWidth={2} />
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
        <span
          className="dc-num"
          style={{ fontSize: numberSize, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}
        >
          {loading ? '…' : current}
        </span>
        <span style={{ fontSize: 18, fontWeight: 700 }}>日連続</span>
      </div>

      {/* 事実 → 励まし の順（DESIGN.md §12）。自己ベスト更新中は煽らずに1つへ畳む */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {loading ? (
          <Pill>読み込んでいます…</Pill>
        ) : (
          <>
            <Pill>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#FFD34D" aria-hidden="true">
                <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-1.5 10h-15z" />
              </svg>
              ベスト {best}日
            </Pill>
            {isNewBest ? (
              <Pill>自己ベスト更新中！</Pill>
            ) : (
              <Pill>あと{remain}日で自己ベスト</Pill>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export default StreakHeroCard;
