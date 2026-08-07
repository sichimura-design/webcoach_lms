import { useNavigate } from 'react-router-dom';
import { Check, Target } from 'lucide-react';
import { useNextCoachingPlan } from '../../hooks/useNextCoachingPlan';
import { color, radius, shadow, font, t } from '../../theme/webcoachTheme';
import { ArrowRightIcon } from './ContinueLearningHero';

/**
 * 次回コーチングまでの目標（マイページ）。
 *
 * 目標の出どころはコーチング記録。コーチングノートで「確定」した目標が
 * そのままここに載る（モックでは mocks/coachingGoalsStore.ts が両者をつないでいる）。
 *
 * 🔴 このカードは表示専用。
 *    以前はここに編集モードがあり、さらに「コーチング記録を取り込む」「続ける」「編集」と
 *    行き先の違う入口が3つ並んでいて、どれを押せば何ができるのか分からなかった（レビュー指摘）。
 *    いまは操作を「編集」と「詳しく」の2つに統一し、どちらもコーチングページへ送る。
 *    実際の編集UIは components/CoachingNotesPage.tsx の「次回までの目標」にある。
 *
 * 🔴 表示は最大 VISIBLE_LIMIT 件まで。
 *    目標が増えるたびに縦に伸びてマイページ全体のバランスが崩れるため、
 *    件数に上限を決めて、残りはコーチングページで見せる。
 */
interface NextCoachingPlanProps {
  userId: number | undefined;
}

/** マイページに並べる目標の上限。これを超えたぶんは件数だけ知らせる。 */
const VISIBLE_LIMIT = 3;

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

/** 達成状況のリング。数字だけより「あと1つ」が直感的に分かる */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const size = 46;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = total > 0 ? done / total : 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color.trackBg} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color.primary}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          style={{ transition: 'stroke-dashoffset 400ms ease' }}
        />
      </svg>
      <div style={{ lineHeight: 1.25 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: color.text, fontVariantNumeric: 'tabular-nums' }}>
          {done}/{total} <span style={{ fontSize: 12, fontWeight: 700 }}>達成</span>
        </div>
        <div style={{ ...font.caption, color: color.textFaint }}>いまの進捗</div>
      </div>
    </div>
  );
}

/** 目標1件。横に並べるので、丈が揃うようカード型にする */
function GoalCard({ text, done, isNext }: { text: string; done: boolean; isNext: boolean }) {
  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 0,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 11,
        padding: '14px 15px',
        borderRadius: radius.md,
        border: `1px solid ${isNext ? color.primaryBorder : color.border}`,
        background: isNext ? color.hoverBgTint : color.surface,
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          flex: '0 0 24px',
          borderRadius: '50%',
          boxSizing: 'border-box',
          display: 'grid',
          placeItems: 'center',
          background: done ? color.primary : 'transparent',
          border: done
            ? 'none'
            : isNext
              ? `2px solid ${color.primary}`
              : `2px dashed ${color.primaryDashed}`,
        }}
      >
        {done && <Check size={13} strokeWidth={3} color={color.textOnPrimary} />}
      </span>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            lineHeight: 1.6,
            color: done ? color.textSubtle : color.textStrong,
            textDecoration: done ? 'line-through' : 'none',
          }}
        >
          {text}
        </div>
        <div style={{ ...font.caption, color: color.textFaint, marginTop: 5 }}>
          {done ? '達成ずみ' : isNext ? 'いま取り組むもの' : 'このあと'}
        </div>
      </div>
    </div>
  );
}

function NextCoachingPlan({ userId }: NextCoachingPlanProps) {
  const navigate = useNavigate();
  const { items, nextSession, loading, error } = useNextCoachingPlan(userId);

  if (loading) return null;

  const completedCount = items.filter((g) => g.completed).length;
  const currentIndex = items.findIndex((g) => !g.completed);
  const visible = items.slice(0, VISIBLE_LIMIT);
  const hiddenCount = items.length - visible.length;

  const goCoaching = () => navigate('/coaching');

  return (
    <section
      style={{
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: radius.card,
        boxShadow: shadow.card,
        padding: '22px 24px 18px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
          <span
            style={{
              width: 38,
              height: 38,
              flex: '0 0 38px',
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: color.primarySoft,
            }}
          >
            <Target size={19} color={color.primary} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...font.cardTitle, color: color.text }}>次回コーチングまでの目標</div>
            <div style={{ ...font.caption, color: color.textSubtle, marginTop: 5, lineHeight: 1.7 }}>
              小さな一歩の積み重ねが、大きな未来をつくります。
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          {items.length > 0 && <ProgressRing done={completedCount} total={items.length} />}
          {/* 🔴 編集の実体はコーチングページ。ここは入口だけ。 */}
          <button
            type="button"
            onClick={goCoaching}
            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{ ...t.chip, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            編集
          </button>
        </div>
      </div>

      {nextSession && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <CalendarIcon />
          <span style={{ fontSize: 12.5, fontWeight: 500, color: color.textSecondary }}>
            {nextSession.date} - {nextSession.coach}
          </span>
        </div>
      )}

      {error && <div style={{ ...font.caption, color: color.primary, marginTop: 12 }}>{error}</div>}

      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: color.textSubtle, marginTop: 16, lineHeight: 1.9 }}>
          次回のコーチングで、コーチと一緒にここまでの目標を決めましょう。
          <br />
          コーチング記録を確定すると、決まった目標がここに入ります。
        </p>
      ) : (
        <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
          {visible.map((item, i) => (
            <GoalCard key={item.no} text={item.text} done={item.completed} isNext={i === currentIndex} />
          ))}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 18 }} />
      {/* 🔴 フッターの導線は1つだけ。行き先は上の「編集」と同じコーチングページ。 */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={goCoaching}
          className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'transparent',
            border: 'none',
            padding: '6px 8px',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 700,
            color: color.primary,
            cursor: 'pointer',
          }}
        >
          {hiddenCount > 0 ? `すべての目標を見る（ほか${hiddenCount}件）` : '詳しく'}
          <ArrowRightIcon size={15} stroke="currentColor" />
        </button>
      </div>
    </section>
  );
}

export default NextCoachingPlan;
