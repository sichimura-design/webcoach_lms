import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { PlanItem, useNextCoachingPlan } from '../../hooks/useNextCoachingPlan';
import { color, radius, shadow, font, t } from '../../theme/webcoachTheme';
import { ArrowRightIcon } from './ContinueLearningHero';

/**
 * 次回コーチングまでの目標。
 *
 * 目標の出どころはコーチング記録。コーチングノートで「確定」した目標が
 * そのままここに載る（モックでは mocks/coachingGoalsStore.ts が両者をつないでいる）。
 * その上で、受講生がこのカードで文言の修正・完了チェック・追加・削除ができる。
 *
 * 🔴 編集は「編集モードに入って、まとめて保存」にしている。
 *    1文字ごとに保存すると、打っている途中の文言が保存され、
 *    別タブや次の取得で中途半端な状態が正になってしまう。
 */
interface NextCoachingPlanProps {
  userId: number | undefined;
  onContinue: () => void;
}

function CalendarIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color.primary} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </svg>
  );
}

/** 3状態のマーカー（完了 / いま / 未着手）。表示モードで使う */
function Marker({ state }: { state: 'done' | 'current' | 'later' }) {
  if (state === 'done') {
    return (
      <span
        style={{
          width: 27,
          height: 27,
          flex: '0 0 27px',
          borderRadius: '50%',
          background: color.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Check size={14} strokeWidth={3} color="#FFFFFF" />
      </span>
    );
  }
  return (
    <span
      style={{
        width: 27,
        height: 27,
        flex: '0 0 27px',
        borderRadius: '50%',
        border:
          state === 'current'
            ? `2px solid ${color.textStrong}`
            : `2px dashed ${color.primaryDashed}`,
        boxSizing: 'border-box',
      }}
    />
  );
}

const iconButton: React.CSSProperties = {
  width: 30,
  height: 30,
  display: 'grid',
  placeItems: 'center',
  border: `1px solid ${color.borderSoft}`,
  borderRadius: 9,
  background: color.surface,
  color: color.textMuted,
  cursor: 'pointer',
  flexShrink: 0,
};

function NextCoachingPlan({ userId, onContinue }: NextCoachingPlanProps) {
  const { items, nextSession, loading, saving, error, save } = useNextCoachingPlan(userId);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PlanItem[]>([]);

  // 編集を始めた時点の内容を下書きに写す。
  // 表示中に取得が走っても、編集中の入力が上書きされないようにする。
  useEffect(() => {
    if (!editing) setDraft(items);
  }, [items, editing]);

  if (loading) return null;

  const completedCount = items.filter((g) => g.completed).length;
  const currentIndex = items.findIndex((g) => !g.completed);

  const startEdit = () => {
    setDraft(items.map((i) => ({ ...i })));
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(items);
    setEditing(false);
  };

  const commit = async () => {
    // 空行は保存しない（削除したいときに空にする操作を許すため）
    const cleaned = draft
      .map((d) => ({ ...d, text: d.text.trim() }))
      .filter((d) => d.text.length > 0);
    const ok = await save(cleaned);
    if (ok) setEditing(false);
  };

  const patch = (index: number, next: Partial<PlanItem>) =>
    setDraft((prev) => prev.map((d, i) => (i === index ? { ...d, ...next } : d)));

  const remove = (index: number) => setDraft((prev) => prev.filter((_, i) => i !== index));

  const add = () =>
    setDraft((prev) => [
      ...prev,
      { no: prev.length + 1, text: '', completed: false, progress: 0 },
    ]);

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ ...font.cardTitle, color: color.text }}>次回コーチングまでの目標</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {items.length > 0 && !editing && (
            <div style={{ fontSize: 12.5, fontWeight: 700, color: color.primary }}>
              {completedCount}/{items.length} 完了
            </div>
          )}
          {editing ? (
            <>
              <button
                type="button"
                onClick={cancelEdit}
                aria-label="編集をやめる"
                title="編集をやめる"
                className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={iconButton}
              >
                <X size={14} />
              </button>
              <button
                type="button"
                onClick={commit}
                disabled={saving}
                className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  ...t.chip,
                  border: 'none',
                  background: color.primary,
                  color: color.textOnPrimary,
                  padding: '7px 14px',
                  cursor: saving ? 'default' : 'pointer',
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? '保存中…' : '保存する'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{ ...t.chip, border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <Pencil size={12} />
              編集
            </button>
          )}
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

      {error && (
        <div style={{ ...font.caption, color: color.primary, marginTop: 12 }}>{error}</div>
      )}

      {/* ---- 編集モード ---- */}
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
          {draft.map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 12px',
                border: `1px solid ${color.border}`,
                borderRadius: radius.md,
              }}
            >
              <input
                type="checkbox"
                checked={item.completed}
                onChange={(e) => patch(i, { completed: e.target.checked })}
                aria-label="達成した"
                style={{ accentColor: color.primary, flexShrink: 0, width: 17, height: 17 }}
              />
              <input
                value={item.text}
                onChange={(e) => patch(i, { text: e.target.value })}
                placeholder="例）バナーを1つ完成させる"
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  fontSize: 14.5,
                  color: color.textStrong,
                  background: 'transparent',
                  textDecoration: item.completed ? 'line-through' : 'none',
                }}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="この目標を削除する"
                title="削除する"
                className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={iconButton}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={add}
            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 7,
              border: `1px dashed ${color.primaryDashed}`,
              borderRadius: radius.md,
              padding: '11px 14px',
              background: color.surface,
              color: color.primary,
              fontFamily: 'inherit',
              ...font.buttonSm,
              cursor: 'pointer',
            }}
          >
            <Plus size={14} />
            目標を追加する
          </button>

          <p style={{ ...font.caption, color: color.textMuted, margin: '2px 0 0', lineHeight: 1.8 }}>
            コーチングで決めた目標は、コーチング記録を確定すると自動でここに入ります。
          </p>
        </div>
      ) : items.length === 0 ? (
        <p style={{ fontSize: 13, color: color.textSubtle, marginTop: 16, lineHeight: 1.9 }}>
          次回のコーチングで、コーチと一緒にここまでの目標を決めましょう。
          <br />
          コーチング記録を取り込むと、決まった目標がここに入ります。
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, marginTop: 24 }}>
          {items.map((item, i) => {
            const isNext = i === currentIndex;
            const state = item.completed ? 'done' : isNext ? 'current' : 'later';
            return (
              <div key={item.no} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <Marker state={state} />
                <span
                  style={{
                    fontSize: 14.5,
                    fontWeight: 500,
                    color: state === 'later' ? color.textSubtle : color.textStrong,
                    textDecoration: item.completed ? 'line-through' : 'none',
                  }}
                >
                  {item.text}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ flex: 1, minHeight: 22 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Link
          to="/coaching"
          style={{ fontSize: 12.5, fontWeight: 700, color: color.primary, textDecoration: 'none' }}
        >
          コーチング記録を取り込む
        </Link>
        <div
          onClick={onContinue}
          role="button"
          tabIndex={0}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, fontSize: 13, fontWeight: 700, color: color.textMuted, cursor: 'pointer' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = color.primary; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = color.textMuted; }}
        >
          <span>続ける</span>
          <ArrowRightIcon size={15} stroke="currentColor" />
        </div>
      </div>
    </section>
  );
}

export default NextCoachingPlan;
