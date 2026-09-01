/**
 * コーチングページ（案1C）の確認ダイアログ。
 *
 * 🔴 window.confirm を使わないのは、失われるものを「一覧」で見せたいから。
 *    「1件削除します」と文章で言われても、どれが消えるのかは分からない。
 *
 * 🔴 初期フォーカスは取り消し側に置く。Enter の連打でそのまま破壊的操作が
 *    通ってしまうと、確認を挟んだ意味がなくなる。
 */
import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { C } from './design1c';

interface ConfirmDialogProps {
  title: string;
  description?: string;
  /** 失われる項目。空なら一覧そのものを出さない */
  items?: string[];
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 一覧に出す最大件数。これを超えたぶんは件数だけ知らせる */
const ITEM_LIMIT = 6;

export function ConfirmDialog({
  title,
  description,
  items = [],
  confirmLabel,
  cancelLabel = 'やめる',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const visible = items.slice(0, ITEM_LIMIT);

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background: 'rgba(20,14,8,.42)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cg-confirm-title"
        style={{
          width: '100%',
          maxWidth: 440,
          maxHeight: '86vh',
          overflowY: 'auto',
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 16,
          boxShadow: '0 24px 56px -20px rgba(60,48,32,.45)',
          padding: 22,
        }}
      >
        <div style={{ display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <span
            aria-hidden
            style={{
              width: 30,
              height: 30,
              borderRadius: 9999,
              flex: 'none',
              display: 'grid',
              placeItems: 'center',
              background: C.brandSoft,
            }}
          >
            <AlertTriangle size={15} strokeWidth={2} color={C.brand} />
          </span>
          <div style={{ minWidth: 0 }}>
            <h2 id="cg-confirm-title" style={{ margin: 0, fontSize: 15.5, fontWeight: 700, color: C.ink, lineHeight: 1.5 }}>
              {title}
            </h2>
            {description && (
              <p style={{ margin: '7px 0 0', fontSize: 12.5, color: C.muted, lineHeight: 1.85 }}>{description}</p>
            )}
          </div>
        </div>

        {visible.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              margin: '14px 0 0',
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
              background: C.brandFaint,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
            }}
          >
            {visible.map((text, i) => (
              <li
                key={i}
                style={{
                  fontSize: 12.5,
                  color: C.body,
                  lineHeight: 1.7,
                  textDecoration: 'line-through',
                  textDecorationColor: C.faint,
                  wordBreak: 'break-word',
                }}
              >
                {text}
              </li>
            ))}
            {items.length > visible.length && (
              <li style={{ fontSize: 12, color: C.muted }}>ほか{items.length - visible.length}件</li>
            )}
          </ul>
        )}

        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
          <button
            type="button"
            ref={cancelRef}
            className="cg-btn-ghost focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            onClick={onCancel}
            style={{
              background: C.surface,
              border: `1px solid ${C.borderInput}`,
              borderRadius: 9,
              padding: '9px 16px',
              fontSize: 12.5,
              fontWeight: 700,
              fontFamily: 'inherit',
              color: C.ink,
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="cg-btn-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            onClick={onConfirm}
            disabled={busy}
            style={{
              background: C.brand,
              border: `1px solid ${C.brand}`,
              borderRadius: 9,
              padding: '9px 16px',
              fontSize: 12.5,
              fontWeight: 700,
              fontFamily: 'inherit',
              color: '#fff',
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.6 : 1,
              boxShadow: '0 3px 8px -4px rgba(220,12,49,.5)',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
