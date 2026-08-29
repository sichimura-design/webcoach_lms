/**
 * 次回コーチングカード下段の連絡先セル（Slackリンク / コーチのメールアドレス）。
 * デザイン『コーチング トップ 3案.dc.html』案1C。
 *
 * 1セルが「未登録 → 入力中 → 登録済み」の3状態を1行の中で持つ。
 * モーダルにしないのが要点で、会議リンクと同じく「その場で貼って終わり」にする。
 */
import React, { useState } from 'react';
import { C, GHOST_BUTTON, INPUT, TEXT_LINK_BUTTON, WARN_PILL } from './design1c';

interface CoachContactCellProps {
  icon: React.ReactNode;
  label: string;
  /** 登録済みの値。未登録は null */
  value: string | null;
  placeholder: string;
  /** 未登録のときのボタン文言（「リンクを登録」「アドレスを登録」） */
  idleButtonLabel: string;
  /** 保存。エラーメッセージを返すと入力欄に留まってその文言を出す。成功なら null */
  onSave: (next: string) => Promise<string | null>;
  /** 登録済みのとき、値の右に足す操作（「開く ›」「コピー」） */
  renderAction?: (value: string) => React.ReactNode;
  /** 左セルだけ縦罫を持つ */
  borderRight?: boolean;
}

export function CoachContactCell({
  icon,
  label,
  value,
  placeholder,
  idleButtonLabel,
  onSave,
  renderAction,
  borderRight,
}: CoachContactCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setDraft(value ?? '');
    setError(null);
    setEditing(true);
  };

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    const message = await onSave(draft.trim());
    setSaving(false);
    if (message) {
      setError(message);
      return;
    }
    setEditing(false);
    setError(null);
  };

  return (
    <div
      style={{
        padding: '10px 16px',
        borderRight: borderRight ? `1px solid ${C.border}` : undefined,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        justifyContent: 'center',
        minHeight: 48,
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: C.ink }}>
        <span style={{ display: 'flex', flex: 'none' }}>{icon}</span>
        {/* ラベルは折り返さない。折り返すとセルの丈が伸びて、
            左右2セルの高さが値の有無で食い違う。溢れるのは値の側（下で ellipsis） */}
        <span style={{ whiteSpace: 'nowrap', flex: 'none' }}>{label}</span>
        <div style={{ flex: 1 }} />

        {!value && !editing && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
            <span style={WARN_PILL}>未登録</span>
            <button type="button" className="cg-btn-ghost" onClick={startEdit} style={GHOST_BUTTON}>
              {idleButtonLabel}
            </button>
          </span>
        )}

        {value && !editing && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span
              title={value}
              style={{
                fontSize: 12.5,
                fontWeight: 400,
                color: C.ink,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 180,
              }}
            >
              {value}
            </span>
            {renderAction?.(value)}
            <button type="button" onClick={startEdit} style={TEXT_LINK_BUTTON}>
              変更
            </button>
          </span>
        )}
      </div>

      {editing && (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit();
                if (e.key === 'Escape') setEditing(false);
              }}
              placeholder={placeholder}
              aria-label={label}
              style={{ ...INPUT, flex: 1 }}
            />
            <button
              type="button"
              className="cg-btn-primary"
              onClick={() => void submit()}
              disabled={saving}
              style={{
                background: C.brand,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '0 14px',
                fontSize: 12,
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: saving ? 'default' : 'pointer',
                opacity: saving ? 0.6 : 1,
                flex: 'none',
              }}
            >
              登録
            </button>
            <button
              type="button"
              className="cg-btn-ghost"
              onClick={() => setEditing(false)}
              aria-label="キャンセル"
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                border: `1px solid ${C.borderInput}`,
                background: C.surface,
                color: C.muted,
                fontSize: 14,
                cursor: 'pointer',
                flex: 'none',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
          {error && <div style={{ fontSize: 11.5, color: C.brandInk }}>{error}</div>}
        </>
      )}
    </div>
  );
}

export default CoachContactCell;
