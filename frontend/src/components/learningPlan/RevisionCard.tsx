/**
 * frontend/src/components/learningPlan/RevisionCard.tsx
 * LMSが作った更新案の提示と、それへの4択の回答。
 *
 * 「ロードマップを変更してください」と依頼するのではなく、差分を作って見せて選ばせるのが要点。
 * 何も選ばなくても現行ロードマップは維持されるので、閉じてしまっても機能は止まらない。
 */
import { useState } from 'react';
import { PlanDiff, PlanRevision, RevisionAction } from '../../types/learningPlan';
import { color, font, radius, t } from '../../theme/webcoachTheme';

interface RevisionCardProps {
  revision: PlanRevision;
  /** 未操作のまま溜まっている件数（1件を超えるときだけ添える） */
  pendingCount: number;
  busy: boolean;
  onResolve: (action: RevisionAction, selectedDiffIds: string[]) => void;
  onOpenEditor: () => void;
}

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color.textSubtle} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function DiffRow({ diff, checked, onToggle }: { diff: PlanDiff; checked: boolean; onToggle: () => void }) {
  return (
    <label
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
        border: `1px solid ${checked ? color.primaryBorder : color.border}`,
        background: checked ? color.hoverBgTint : color.surface,
        borderRadius: radius.md, cursor: 'pointer',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        style={{ marginTop: 3, width: 17, height: 17, accentColor: color.primary, cursor: 'pointer', flex: '0 0 17px' }}
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: color.textStrong }}>{diff.label}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: color.textSubtle, textDecoration: 'line-through' }}>{diff.before}</span>
          <ArrowIcon />
          <span style={{ fontSize: 12, fontWeight: 700, color: color.primary }}>{diff.after}</span>
        </span>
      </span>
    </label>
  );
}

function RevisionCard({ revision, pendingCount, busy, onResolve, onOpenEditor }: RevisionCardProps) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(revision.diffs.filter((d) => d.selected).map((d) => d.id)),
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = revision.diffs.every((d) => selected.has(d.id));
  const ids = Array.from(selected);

  const buttons: { label: string; action: RevisionAction; primary?: boolean; disabled?: boolean }[] = [
    { label: '提案どおり更新', action: 'apply_all', primary: true },
    { label: '期間だけ変更', action: 'apply_dates_only' },
    { label: '現状を維持', action: 'keep_current' },
  ];

  return (
    <section
      style={{
        background: color.surface, border: `1px solid ${color.primaryBorder}`,
        borderRadius: radius.card, boxShadow: '0 8px 26px rgba(190,60,70,.10)', padding: '22px 24px 20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ ...t.chip }}>更新候補</span>
        <span style={{ ...font.cardTitle, color: color.text }}>{revision.headline}</span>
        {pendingCount > 1 && (
          <span style={{ ...font.caption, color: color.textSubtle }}>ほか{pendingCount - 1}件の候補があります</span>
        )}
      </div>

      <p style={{ ...font.meta, color: color.textBody, margin: '10px 0 0', lineHeight: 1.8 }}>{revision.detail}</p>

      {revision.checkin === null && (
        <p style={{ ...font.caption, color: color.textFaint, margin: '8px 0 0' }}>
          ※ ふりかえりが未回答のため、教材の進捗・提出数などの実績だけをもとに作成した案です。
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
        {revision.diffs.map((d) => (
          <DiffRow key={d.id} diff={d} checked={selected.has(d.id)} onToggle={() => toggle(d.id)} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
        {buttons.map((b) => (
          <button
            key={b.action}
            type="button"
            disabled={busy}
            onClick={() => onResolve(b.action, ids)}
            style={
              b.primary
                ? { ...t.primaryButton, padding: '13px 22px', fontSize: 13.5, opacity: busy ? 0.6 : 1 }
                : { ...t.outlineButton, opacity: busy ? 0.6 : 1 }
            }
          >
            {b.label}
          </button>
        ))}
        <button type="button" disabled={busy} onClick={onOpenEditor} style={{ ...t.outlineButton, opacity: busy ? 0.6 : 1 }}>
          詳細を編集
        </button>
        {!allSelected && (
          <button
            type="button"
            disabled={busy || ids.length === 0}
            onClick={() => onResolve('apply_selected', ids)}
            style={{ ...t.outlineButton, opacity: busy || ids.length === 0 ? 0.5 : 1 }}
          >
            選んだ{ids.length}件だけ更新
          </button>
        )}
      </div>
    </section>
  );
}

export default RevisionCard;
