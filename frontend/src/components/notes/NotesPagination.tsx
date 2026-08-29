/**
 * 一覧のページ送り（デザイン 1a 下部）。
 * 中央に ‹ ページ番号 ›、右端に「1–24 / 28件」。
 *
 * ノートは全件まとめて取ってきている（MSWのモックで件数も小さい）ので、
 * ページ送りはクライアント側で切るだけ。チップを押した瞬間に
 * 再フェッチが走らないぶん、絞り込みの反応が速い。
 */
interface NotesPaginationProps {
  page: number;
  pageCount: number;
  /** 絞り込み後の総件数 */
  total: number;
  /** 表示中の先頭・末尾（1始まり） */
  from: number;
  to: number;
  onChange: (page: number) => void;
}

const CIRCLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 36,
  height: 36,
  borderRadius: 9999,
  fontFamily: 'inherit',
  fontSize: 14,
};

export function NotesPagination({ page, pageCount, total, from, to, onChange }: NotesPaginationProps) {
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        paddingTop: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Arrow label="前のページ" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          ‹
        </Arrow>

        {pages.map((n) => {
          const current = n === page;
          return (
            <button
              key={n}
              type="button"
              aria-current={current ? 'page' : undefined}
              onClick={() => onChange(n)}
              className="dc-num focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                ...CIRCLE,
                border: current ? 0 : '1px solid var(--dc-border)',
                background: current ? 'var(--dc-primary)' : 'var(--dc-surface)',
                color: current ? '#FFFFFF' : 'var(--dc-text-body)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {n}
            </button>
          );
        })}

        <Arrow label="次のページ" disabled={page >= pageCount} onClick={() => onChange(page + 1)}>
          ›
        </Arrow>
      </div>

      <span
        className="dc-num notes-pager-count"
        style={{ position: 'absolute', right: 0, fontSize: 12, color: 'var(--dc-text-muted)' }}
      >
        {from}–{to} / {total}件
      </span>
    </div>
  );
}

function Arrow({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{
        ...CIRCLE,
        border: '1px solid var(--dc-border)',
        background: 'var(--dc-surface)',
        color: disabled ? 'var(--dc-text-subtle)' : 'var(--dc-text-body)',
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

export default NotesPagination;
