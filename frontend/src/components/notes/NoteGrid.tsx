import { NotebookPen, Plus, SearchX } from 'lucide-react';
import { NoteSummary } from '../../types/notes';
import NoteCard from './NoteCard';

/**
 * 一覧のカードグリッド（デザイン 1a）。3列 → 2列 → 1列は index.css の .notes-grid。
 *
 * 空状態を2つに分けている。1枚も無いのか、絞り込んだ結果0枚なのかで
 * 次にやることが違う（作る／条件を外す）ため。
 * 文言は CONTENTS §14-1 No.04 を正とする。
 */
interface NoteGridProps {
  items: NoteSummary[];
  loading: boolean;
  /** 検索・チップを掛ける前の総数。0 なら「まだ1枚も無い」 */
  totalCount: number;
  onOpen: (id: string) => void;
  onToggleFavorite: (note: NoteSummary) => void;
  onDelete: (note: NoteSummary) => void;
  onCreate: () => void;
  onClearFilters: () => void;
}

export function NoteGrid({
  items,
  loading,
  totalCount,
  onOpen,
  onToggleFavorite,
  onDelete,
  onCreate,
  onClearFilters,
}: NoteGridProps) {
  if (loading && items.length === 0) {
    return (
      <div className="notes-grid" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              height: 176,
              background: 'var(--dc-surface)',
              border: '1px solid var(--dc-border)',
              borderRadius: 'var(--dc-radius-lg)',
              boxShadow: 'var(--dc-shadow-card)',
            }}
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return totalCount === 0 ? (
      <EmptyState
        icon={<NotebookPen size={26} style={{ color: 'var(--dc-primary)' }} />}
        title="最初のノートをつくりましょう"
        body="学んだことを自分の言葉で残せます。"
        action={
          <button
            type="button"
            onClick={onCreate}
            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '13px 28px',
              border: 0,
              borderRadius: 9999,
              background: 'var(--dc-primary)',
              color: '#FFFFFF',
              fontFamily: 'inherit',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Plus size={17} /> 新しいノートを作成
          </button>
        }
      />
    ) : (
      <EmptyState
        icon={<SearchX size={26} style={{ color: 'var(--dc-text-subtle)' }} />}
        title="条件に一致するノートがありません"
        body="キーワードを短くするか、絞り込みを外してみてください。"
        action={
          <button
            type="button"
            onClick={onClearFilters}
            className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            style={{
              padding: '11px 22px',
              border: '1px solid var(--dc-border-strong)',
              borderRadius: 9999,
              background: 'var(--dc-surface)',
              color: 'var(--dc-text-body)',
              fontFamily: 'inherit',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            条件をクリア
          </button>
        }
      />
    );
  }

  return (
    <div className="notes-grid">
      {items.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onOpen={onOpen}
          onToggleFavorite={onToggleFavorite}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        padding: '72px 32px',
        background: 'var(--dc-surface)',
        border: '1px solid var(--dc-border)',
        borderRadius: 'var(--dc-radius-lg)',
        boxShadow: 'var(--dc-shadow-card)',
        textAlign: 'center',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 56,
          height: 56,
          borderRadius: 9999,
          background: 'var(--dc-soft-100)',
        }}
      >
        {icon}
      </span>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--dc-text)' }}>{title}</h2>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.9, color: 'var(--dc-text-muted)' }}>{body}</p>
      <div style={{ marginTop: 8 }}>{action}</div>
    </div>
  );
}

export default NoteGrid;
