import { useEffect, useState } from 'react';
import { Clock, X } from 'lucide-react';
import {
  WEEKLY_GOAL_STEP_MINUTES,
  clampWeeklyGoal,
} from '../../hooks/useWeeklyGoal';
import { formatMinutesHM } from '../../utils/studyStats';

/**
 * 今週の学習目標を決めるモーダル。claude.ai/design『トップページ 3案』8a 準拠。
 *
 * 🔴 プリセットと ＋/− の両方を出す。プリセットだけだと「週7時間」のような
 *    中途半端な値にできず、ステッパーだけだと初回に何時間が妥当か分からない。
 * 🔴 刻みは30分（useWeeklyGoal.WEEKLY_GOAL_STEP_MINUTES）。1分刻みにすると
 *    目標が「達成できたか」ではなく「あと3分」の話になり、性質が変わる。
 */
interface WeeklyGoalModalProps {
  open: boolean;
  /** 現在の目標（分） */
  value: number;
  saving: boolean;
  onClose: () => void;
  onSave: (minutes: number) => void;
}

/** 週あたりの目安。8a のプリセット4つ */
const PRESETS = [300, 600, 900, 1200];

export function WeeklyGoalModal({ open, value, saving, onClose, onSave }: WeeklyGoalModalProps) {
  const [draft, setDraft] = useState(value);

  // 開くたびに現在値から始める（前回いじって閉じた値を持ち越さない）
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  // Esc で閉じる。モーダルは開いている間だけ購読する
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const perDay = Math.round(draft / 7);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="今週の学習目標"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(30,12,10,.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          maxWidth: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--dc-surface)',
          borderRadius: 'var(--dc-radius-lg)',
          boxShadow: '0 30px 60px -20px rgba(40,10,10,.45)',
          padding: '28px 30px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span
            style={{
              width: 34,
              height: 34,
              flex: 'none',
              borderRadius: 9999,
              background: 'var(--dc-soft-100)',
              color: 'var(--dc-primary)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Clock size={18} strokeWidth={1.75} />
          </span>
          <h2 style={{ margin: 0, flex: 1, fontSize: 18, fontWeight: 800, color: 'var(--dc-text)' }}>
            今週の学習目標
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              width: 32,
              height: 32,
              borderRadius: 9999,
              display: 'grid',
              placeItems: 'center',
              border: 0,
              background: 'transparent',
              color: 'var(--dc-text-subtle)',
              cursor: 'pointer',
            }}
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: 'var(--dc-text-muted)', lineHeight: 1.7, margin: '0 0 20px 44px' }}>
          1週間で学習する時間の目標です。達成状況はトップページのゲージに表示されます。
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          {PRESETS.map((p) => {
            const active = draft === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setDraft(p)}
                aria-pressed={active}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  flex: 1,
                  textAlign: 'center',
                  border: `1.5px solid ${active ? 'var(--dc-primary)' : 'var(--dc-border)'}`,
                  background: active ? 'var(--dc-soft-100)' : 'var(--dc-surface)',
                  color: active ? 'var(--dc-primary)' : 'var(--dc-text-body)',
                  borderRadius: 'var(--dc-radius-md)',
                  padding: '10px 0',
                  fontFamily: 'inherit',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {formatMinutesHM(p)}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            border: '1px solid var(--dc-border)',
            background: 'var(--dc-bg)',
            borderRadius: 16,
            padding: 18,
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            onClick={() => setDraft((v) => clampWeeklyGoal(v - WEEKLY_GOAL_STEP_MINUTES))}
            aria-label="30分減らす"
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              width: 42,
              height: 42,
              flex: 'none',
              borderRadius: 9999,
              border: '1.5px solid var(--dc-border-strong)',
              background: 'var(--dc-surface)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 20,
              color: 'var(--dc-text-muted)',
              cursor: 'pointer',
            }}
          >
            −
          </button>
          <div
            className="dc-num"
            aria-live="polite"
            style={{ minWidth: 160, textAlign: 'center', fontSize: 30, fontWeight: 800, color: 'var(--dc-text)' }}
          >
            {formatMinutesHM(draft)}
          </div>
          <button
            type="button"
            onClick={() => setDraft((v) => clampWeeklyGoal(v + WEEKLY_GOAL_STEP_MINUTES))}
            aria-label="30分増やす"
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              width: 42,
              height: 42,
              flex: 'none',
              borderRadius: 9999,
              border: '1.5px solid var(--dc-border-strong)',
              background: 'var(--dc-surface)',
              display: 'grid',
              placeItems: 'center',
              fontSize: 20,
              color: 'var(--dc-text-muted)',
              cursor: 'pointer',
            }}
          >
            ＋
          </button>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--dc-text-muted)', textAlign: 'center', marginBottom: 22 }}>
          1日あたり {formatMinutesHM(perDay)} が目安（30分きざみで調整できます）
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            className="dc-cta-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--dc-border-strong)',
              background: 'var(--dc-surface)',
              color: 'var(--dc-text-muted)',
              borderRadius: 'var(--dc-radius-md)',
              padding: '13px 0',
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={() => onSave(draft)}
            disabled={saving}
            className="dc-cta-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              flex: 1.4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 0,
              background: 'var(--dc-primary)',
              color: '#fff',
              borderRadius: 'var(--dc-radius-md)',
              padding: '13px 0',
              fontFamily: 'inherit',
              fontSize: 14,
              fontWeight: 800,
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.7 : 1,
              boxShadow: '0 8px 18px -8px rgba(160,8,36,.6)',
            }}
          >
            {saving ? '保存しています…' : 'この目標で設定する'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default WeeklyGoalModal;
