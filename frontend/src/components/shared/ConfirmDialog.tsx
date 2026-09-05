/**
 * 確認ダイアログ（--dc-* トークン版）。
 * ============================================================
 * 🔴 coaching/ConfirmDialog.tsx と2つ並存している。あちらは中身が全部 design1c.ts の
 *    C（/coaching 専用の暖色クリーム）で組まれていて、.mypage-3d 配下に持ち込むと
 *    トークン系統が混ざる。統合するなら /coaching 全体を --dc-* へ移すときに一緒にやること。
 *    props と下の2つの作法は意図的に同じにしてあるので、そのとき差し替えるだけで済む。
 *
 * 🔴 window.confirm を使わないのは、失われるものを「一覧」で見せたいから。
 *    「1件削除します」と文章で言われても、どれが消えるのかは分からない。
 *
 * 🔴 初期フォーカスは取り消し側に置く。Enter の連打でそのまま破壊的操作が
 *    通ってしまうと、確認を挟んだ意味がなくなる。
 * ============================================================
 */
import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

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
        aria-labelledby="dc-confirm-title"
        style={{
          width: '100%',
          maxWidth: 440,
          maxHeight: '86vh',
          overflowY: 'auto',
          background: 'var(--dc-surface)',
          border: '1px solid var(--dc-border)',
          borderRadius: 'var(--dc-radius-md)',
          boxShadow: 'var(--dc-shadow-float)',
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
              background: 'var(--dc-soft-100)',
            }}
          >
            <AlertTriangle size={15} strokeWidth={2} color="var(--dc-primary)" />
          </span>
          <div style={{ minWidth: 0 }}>
            <h2
              id="dc-confirm-title"
              style={{
                margin: 0,
                fontSize: 'var(--dc-fs-lead)',
                fontWeight: 700,
                color: 'var(--dc-text)',
                lineHeight: 'var(--dc-lh-heading)',
              }}
            >
              {title}
            </h2>
            {description && (
              <p
                style={{
                  margin: '7px 0 0',
                  fontSize: 'var(--dc-fs-body)',
                  color: 'var(--dc-text-muted)',
                  lineHeight: 'var(--dc-lh-prose)',
                }}
              >
                {description}
              </p>
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
              background: 'var(--dc-tint-50)',
              border: '1px solid var(--dc-border)',
              borderRadius: 10,
            }}
          >
            {visible.map((text, i) => (
              <li
                key={i}
                style={{
                  fontSize: 'var(--dc-fs-body)',
                  color: 'var(--dc-text-body)',
                  lineHeight: 'var(--dc-lh-ui)',
                  // 消えるものだと形でも分かるように取り消し線を引く（色だけに頼らない）
                  textDecoration: 'line-through',
                  textDecorationColor: 'var(--dc-text-subtle)',
                  wordBreak: 'break-word',
                }}
              >
                {text}
              </li>
            ))}
            {items.length > visible.length && (
              <li style={{ fontSize: 'var(--dc-fs-caption)', color: 'var(--dc-text-muted)' }}>
                ほか{items.length - visible.length}件
              </li>
            )}
          </ul>
        )}

        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
          <button
            type="button"
            ref={cancelRef}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            onClick={onCancel}
            style={{
              background: 'var(--dc-surface)',
              border: '1px solid var(--dc-border-strong)',
              borderRadius: 9,
              padding: '9px 16px',
              fontFamily: 'inherit',
              fontSize: 'var(--dc-fs-body)',
              fontWeight: 700,
              color: 'var(--dc-text-body)',
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            onClick={onConfirm}
            style={{
              background: 'var(--dc-primary)',
              border: '1px solid var(--dc-primary)',
              borderRadius: 9,
              padding: '9px 16px',
              fontFamily: 'inherit',
              fontSize: 'var(--dc-fs-body)',
              fontWeight: 700,
              color: '#fff',
              cursor: busy ? 'default' : 'pointer',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? '処理中…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
