import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { PlanItem, useNextCoachingPlan } from '../../hooks/useNextCoachingPlan';
import { formatMinutesHM } from '../../utils/studyStats';

/**
 * 次回コーチングまでのタスク（マイページ右上）。
 * claude.ai/design『トップページ 3案』8a 準拠。
 *
 * 中身はコーチングノートで「確定」した目標そのもの（useNextCoachingPlan）。
 * 5a で外していた mypage/NextCoachingPlan.tsx の後継だが、見た目が別物なので
 * 差し替えではなく別ファイルにしてある（5a に戻すときは向こうを import し直す）。
 *
 * 🔴 ここでできるのは「チェックの付け外し」だけ。文言の追加・修正・削除は
 *    コーチングノート（/coaching-notes）に置く。トップページに編集UIを持つと、
 *    同じデータの入口が2つになって、どちらが正か分からなくなる。
 *
 * 🔴 CTAは持たせない。マイページ唯一の Primary CTA は ResumeStudyCard の
 *    「続きから学習する」（DESIGN.md §15-5）。ここは見出し右のテキストリンクに留める。
 */
interface CoachingTaskCardProps {
  userId: number | undefined;
}

/** カードに並べるタスクの上限。増やすと左の ResumeStudyCard との高さが揃わなくなる */
const MAX_ROWS = 3;

const CARD_STYLE: CSSProperties = {
  flex: 1,
  background: 'var(--dc-surface)',
  border: '1px solid var(--dc-border)',
  borderRadius: 'var(--dc-radius-lg)',
  boxShadow: 'var(--dc-shadow-card)',
  padding: 'var(--dc-sp-card-y) var(--dc-sp-card-x)',
  display: 'flex',
  flexDirection: 'column',
};

function TaskRow({ item, onToggle, disabled }: { item: PlanItem; onToggle: () => void; disabled: boolean }) {
  const done = item.completed;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        border: `1px solid ${done ? 'var(--dc-soft-200)' : 'var(--dc-border)'}`,
        background: done ? 'var(--dc-soft-100)' : 'transparent',
        borderRadius: 14,
        padding: '15px 16px',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={done}
        aria-label={`${item.text}を${done ? '未完了に戻す' : '完了にする'}`}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          width: 24,
          height: 24,
          flex: 'none',
          borderRadius: 9999,
          padding: 0,
          display: 'grid',
          placeItems: 'center',
          background: done ? 'var(--dc-primary)' : 'transparent',
          border: done ? 0 : '2px solid var(--dc-idle-dash)',
          cursor: disabled ? 'default' : 'pointer',
        }}
      >
        {done && <Check size={13} strokeWidth={2.5} color="#fff" />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* タスク名は「次に何をするか」そのものなので lead(16px)。
            完了済みは取り消し線で役目が終わっているので weight を一段落とす。 */}
        <div
          style={{
            fontSize: 'var(--dc-fs-lead)',
            fontWeight: done ? 500 : 600,
            color: done ? '#B08A8F' : 'var(--dc-text)',
            textDecoration: done ? 'line-through' : 'none',
            lineHeight: 'var(--dc-lh-ui)',
          }}
        >
          {item.text}
        </div>
        {!done && item.estimatedMinutes != null && item.estimatedMinutes > 0 && (
          <div style={{ fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-subtle)', marginTop: 3 }}>
            目安 {formatMinutesHM(item.estimatedMinutes)}
          </div>
        )}
      </div>
    </div>
  );
}

export function CoachingTaskCard({ userId }: CoachingTaskCardProps) {
  const navigate = useNavigate();
  const { items, loading, saving, save } = useNextCoachingPlan(userId);
  // 連打で複数の保存が飛ぶのを防ぐ。どの行を押したかはボタンの見た目に出さない
  const [pending, setPending] = useState(false);

  /*
   * カードに出すのは先頭 MAX_ROWS 件だけ。
   * ============================================================
   * 🔴 全件出さない。このカードは左の ResumeStudyCard と同じ行に並んでいて
   *    （.mypage-8a-grid は align-items:stretch）、行が増えるとこのカードだけ
   *    背が伸びて左側に大きな空白ができる。タスクは
   *    coachingGoalsStore の reflectGoalCandidates が確定のたびに追記するので、
   *    4件以上は普通に起きる（初期データがちょうど3件なので気づきにくい）。
   * 🔴 未完了を先に詰める。ただ先頭から3件取ると、完了済みが3件並んだ日に
   *    「いまやること」が1件も見えないカードになる。
   *    並び自体は崩さない（それぞれの中では元の順序を保つ）。
   * 🔴 溢れたぶんは件数だけ出して /coaching へ送る。ここで全件見せる役は持たない
   *    （編集もあちらが正）。
   * ============================================================
   */
  const [undone, done] = [items.filter((it) => !it.completed), items.filter((it) => it.completed)];
  const visible = [...undone, ...done].slice(0, MAX_ROWS);
  const hidden = items.length - visible.length;

  const toggle = async (target: PlanItem) => {
    if (pending || saving) return;
    setPending(true);
    await save(
      items.map((it) =>
        it.no === target.no
          ? { ...it, completed: !it.completed, progress: it.completed ? 0 : 100 }
          : it
      )
    );
    setPending(false);
  };

  return (
    <section style={CARD_STYLE}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <h2
          style={{
            margin: 0,
            flex: 1,
            fontSize: 'var(--dc-fs-lead)',
            fontWeight: 700,
            color: 'var(--dc-text)',
            lineHeight: 'var(--dc-lh-heading)',
          }}
        >
          次回コーチングまでのタスク
        </h2>
        <button
          type="button"
          onClick={() => navigate('/coaching')}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            border: 0,
            background: 'transparent',
            padding: 0,
            fontFamily: 'inherit',
            fontSize: 'var(--dc-fs-body)',
            fontWeight: 600,
            color: 'var(--dc-primary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          編集する ›
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {loading ? (
          <div style={{ fontSize: 'var(--dc-fs-body)', color: 'var(--dc-text-subtle)', padding: '8px 0' }}>
            読み込んでいます…
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              fontSize: 'var(--dc-fs-body)',
              color: 'var(--dc-text-muted)',
              lineHeight: 'var(--dc-lh-prose)',
              padding: '8px 0',
            }}
          >
            まだタスクがありません。コーチング記録を確定すると、決まったタスクがここに入ります。
          </div>
        ) : (
          visible.map((it) => (
            <TaskRow key={it.no} item={it} onToggle={() => toggle(it)} disabled={pending || saving} />
          ))
        )}

        {hidden > 0 && (
          <button
            type="button"
            onClick={() => navigate('/coaching')}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              alignSelf: 'flex-start',
              border: 0,
              background: 'transparent',
              padding: '2px 0',
              fontFamily: 'inherit',
              fontSize: 'var(--dc-fs-body)',
              fontWeight: 600,
              color: 'var(--dc-primary)',
              cursor: 'pointer',
            }}
          >
            ほか {hidden} 件を見る ›
          </button>
        )}
      </div>

      <div
        style={{
          fontSize: 'var(--dc-fs-caption)',
          color: 'var(--dc-text-subtle)',
          marginTop: 14,
          lineHeight: 'var(--dc-lh-ui)',
        }}
      >
        コーチングノートのタスクを表示しています。編集はコーチングページから。
      </div>
    </section>
  );
}

export default CoachingTaskCard;
