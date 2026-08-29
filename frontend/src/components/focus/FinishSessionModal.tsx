import { useState } from 'react';
import { X } from 'lucide-react';
import { color, font, radius, shadow, t } from '../../theme/webcoachTheme';
import { StudyFinishDraft } from '../../types/studyActivity';
import { formatHMS } from './focusFormat';

interface FinishSessionModalProps {
  draft: StudyFinishDraft;
  committing: boolean;
  onCancel: () => void;
  onCommit: (actualMinutes: number) => void;
}

/**
 * 「終了」を押した後の確認カード。実測時間を見せつつ、ユーザーが最終値を修正できる。
 * durationMinutesはここで確定した値がそのまま集計・ランキングの正データになる。
 */
export function FinishSessionModal({ draft, committing, onCancel, onCommit }: FinishSessionModalProps) {
  const [minutes, setMinutes] = useState(draft.actualMinutes);
  const adjusted = minutes !== Math.max(1, Math.round(draft.measuredSeconds / 60));

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(43,38,41,.45)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 380,
          background: color.surface,
          borderRadius: radius.hero,
          boxShadow: shadow.hero,
          padding: '22px 22px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ ...font.sectionTitle, color: color.text, margin: 0 }}>学習を記録</h2>
          <button
            type="button"
            onClick={onCancel}
            aria-label="閉じる"
            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: color.textMuted, display: 'grid', placeItems: 'center' }}
          >
            <X size={18} />
          </button>
        </div>

        {draft.courseTitle && (
          <div style={{ ...font.meta, color: color.textSubtle }}>{draft.courseTitle}</div>
        )}

        <div
          style={{
            background: color.pageBg,
            border: `1px solid ${color.border}`,
            borderRadius: radius.md,
            padding: '14px 16px',
            textAlign: 'center',
          }}
        >
          <div style={{ ...font.label, color: color.textSubtle }}>計測時間</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: color.text, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {formatHMS(draft.measuredSeconds)}
          </div>
          {draft.completedTarget && (
            <div style={{ ...font.caption, color: color.primary, marginTop: 4 }}>目標時間を達成しました</div>
          )}
        </div>

        <div>
          <div style={{ ...font.label, color: color.textSubtle, marginBottom: 8 }}>記録する学習時間(分)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number"
              min={0}
              max={draft.measuredSeconds / 60 + 240}
              inputMode="numeric"
              value={minutes}
              onChange={(e) => setMinutes(Math.max(0, Number(e.target.value) || 0))}
              style={{
                width: 96,
                textAlign: 'center',
                border: `1px solid ${color.border}`,
                borderRadius: radius.md,
                padding: '9px 8px',
                fontFamily: 'inherit',
                fontSize: 16,
                fontWeight: 700,
                color: color.text,
                outline: 'none',
                boxSizing: 'border-box',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
            <span style={{ ...font.label, color: color.textSubtle }}>分</span>
            {adjusted && <span style={{ ...font.caption, color: color.textFaint }}>(実測から修正)</span>}
          </div>
        </div>

        <div className="flex items-center justify-center" style={{ gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={committing}
            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{ ...t.outlineButton, flex: 1, justifyContent: 'center', cursor: committing ? 'not-allowed' : 'pointer' }}
          >
            計測に戻る
          </button>
          <button
            type="button"
            onClick={() => onCommit(minutes)}
            disabled={committing}
            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              ...t.primaryButton,
              flex: 1,
              justifyContent: 'center',
              cursor: committing ? 'not-allowed' : 'pointer',
              opacity: committing ? 0.6 : 1,
            }}
          >
            {committing ? '記録しています…' : '記録する'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default FinishSessionModal;
