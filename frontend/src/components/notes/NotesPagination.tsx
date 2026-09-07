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
        <Arrow label="前のページ" direction="prev" disabled={page <= 1} onClick={() => onChange(page - 1)} />

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

        <Arrow label="次のページ" direction="next" disabled={page >= pageCount} onClick={() => onChange(page + 1)} />
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

/**
 * ‹ › の文字グリフだと線が細くて番号の丸に埋もれるので、
 * 太さを指定できる SVG のシェブロンにしている。
 */
function Arrow({
  label,
  direction,
  disabled,
  onClick,
}: {
  label: string;
  direction: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
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
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {direction === 'prev' ? <polyline points="15 5 8 12 15 19" /> : <polyline points="9 5 16 12 9 19" />}
      </svg>
    </button>
  );
}

export default NotesPagination;
