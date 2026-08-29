import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight } from 'lucide-react';
import { useNextCoachingPlan } from '../../hooks/useNextCoachingPlan';

/**
 * 次回コーチングまでの目標（マイページ右カラム）。
 * claude.ai/design『マイページ 3d.dc.html』準拠。
 *
 * 目標の出どころはコーチング記録。コーチングノートで「確定」した目標が
 * そのままここに載る（モックでは mocks/coachingGoalsStore.ts が両者をつないでいる）。
 *
 * 🔴 このカードは表示専用。編集UIは components/CoachingNotesPage.tsx の「次回までの目標」。
 *    フッターの導線は1つだけ（かつて入口が3つ並んで何ができるか分からなかったレビュー指摘）。
 *
 * 🔴 進捗はリングではなくバー。デザインが横長の細いカードになり、
 *    リング（直径46px）を置くとヘッダ行が2段に割れるため。
 *
 * 🔴 表示は最大 VISIBLE_LIMIT 件。目標が増えるたびに縦に伸びて
 *    右カラム全体のバランスが崩れるので、残りはコーチングページで見せる。
 */
interface NextCoachingPlanProps {
  userId: number | undefined;
}

/** マイページに並べる目標の上限。これを超えたぶんは件数だけ知らせる。 */
const VISIBLE_LIMIT = 3;

/** 目標1件。デザインは罫線区切りの素の行（カード型ではない） */
function GoalRow({ text, done, last }: { text: string; done: boolean; last: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 0',
        borderBottom: last ? undefined : '1px solid var(--dc-border)',
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          flex: 'none',
          borderRadius: 9999,
          boxSizing: 'border-box',
          display: 'grid',
          placeItems: 'center',
          background: done ? 'var(--dc-success-surface)' : 'transparent',
          border: done ? 'none' : '1.5px solid var(--dc-border-strong)',
        }}
      >
        {done && <Check size={11} strokeWidth={2.5} color="var(--dc-success)" />}
      </span>
      <span
        style={{
          fontSize: 13,
          lineHeight: 1.6,
          color: done ? 'var(--dc-text-subtle)' : 'var(--dc-text-body)',
          textDecoration: done ? 'line-through' : 'none',
        }}
      >
        {text}
      </span>
    </div>
  );
}

function NextCoachingPlan({ userId }: NextCoachingPlanProps) {
  const navigate = useNavigate();
  const { items, loading, error } = useNextCoachingPlan(userId);

  if (loading) return null;

  const completedCount = items.filter((g) => g.completed).length;
  const visible = items.slice(0, VISIBLE_LIMIT);
  const pct = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <section
      style={{
        background: 'var(--dc-surface)',
        border: '1px solid var(--dc-border)',
        borderRadius: 'var(--dc-radius-lg)',
        boxShadow: 'var(--dc-shadow-card)',
        padding: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--dc-text)' }}>次回コーチングまでの目標</h3>
        {items.length > 0 && (
          <span className="dc-num" style={{ fontSize: 11, color: 'var(--dc-text-muted)', flex: 'none' }}>
            {completedCount} / {items.length} 達成
          </span>
        )}
      </div>

      {items.length > 0 && (
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="目標の達成状況"
          style={{ height: 8, borderRadius: 9999, background: 'var(--dc-soft-200)', marginBottom: 14, overflow: 'hidden' }}
        >
          <div
            style={{ width: `${pct}%`, height: '100%', borderRadius: 9999, background: 'var(--dc-primary)', transition: 'width 600ms var(--dc-ease)' }}
          />
        </div>
      )}

      {error && <div style={{ fontSize: 13, color: 'var(--dc-primary)', marginBottom: 12 }}>{error}</div>}

      {items.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--dc-text-muted)', margin: 0, lineHeight: 1.9 }}>
          次回のコーチングで、コーチと一緒にここまでの目標を決めましょう。
          <br />
          コーチング記録を確定すると、決まった目標がここに入ります。
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {visible.map((item, i) => (
            <GoalRow key={item.no} text={item.text} done={item.completed} last={i === visible.length - 1} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate('/coaching')}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
          marginTop: 12,
          border: 0,
          background: 'transparent',
          padding: 0,
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--dc-primary)',
          cursor: 'pointer',
        }}
      >
        すべての目標を見る
        <ChevronRight size={15} strokeWidth={2} />
      </button>
    </section>
  );
}

export default NextCoachingPlan;
