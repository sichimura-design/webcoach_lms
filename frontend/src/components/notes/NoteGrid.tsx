import { useCallback, useRef, useState } from 'react';
import { Folder, FolderOpen, Inbox, NotebookPen, Plus, SearchX, Star } from 'lucide-react';
import { NoteFolder, NoteFolderFilter, NoteSummary } from '../../types/notes';
import AnchoredMenu from './AnchoredMenu';
import NoteCard from './NoteCard';
import { INBOX_LABEL, folderNameOf } from './folderRows';

/**
 * 一覧のカードグリッド。3列 → 2列 → 1列は index.css の .notes-grid。
 *
 * 空状態は「何が空なのか」で分ける。次にやることが違うため（作る／条件を外す／
 * 何もしなくてよい）。
 *   ・1枚も無い            … 最初のノートを作る（CONTENTS §14-1 No.04 の文言）
 *   ・開いたフォルダが空   … このフォルダにノートを作る（改善案で追加した文言）
 *   ・未整理が空／重要が空 … 説明だけ。作らせない
 *   ・絞り込んで0枚         … 条件をクリア
 *
 * カードの「移動先」メニューはここが1つだけ持つ。
 * 🔴 カードの中に置いてはいけない。createPortal のイベントは DOM ではなく React の
 *    ツリーを伝播するので、NoteCard の中から AnchoredMenu を描くと、メニュー項目の
 *    クリックがカードの onClick（＝ノートを開く）まで届く。
 */
interface NoteGridProps {
  items: NoteSummary[];
  loading: boolean;
  /** 検索・チップを掛ける前の総数。0 なら「まだ1枚も無い」 */
  totalCount: number;
  folders: NoteFolder[];
  filter: NoteFolderFilter;
  /** 種類チップや検索語が掛かっているか。空フォルダの文言を出すかどうかの判定 */
  hasOtherFilters: boolean;
  onOpen: (id: string) => void;
  /** カード右上の★ */
  onToggleFavorite: (id: string, favorite: boolean) => void;
  /** カード下部のフォルダ名から選んだ移動先。null は未整理 */
  onMove: (id: string, folderId: string | null) => void;
  onCreate: () => void;
  onClearFilters: () => void;
}

export function NoteGrid({
  items,
  loading,
  totalCount,
  folders,
  filter,
  hasOtherFilters,
  onOpen,
  onToggleFavorite,
  onMove,
  onCreate,
  onClearFilters,
}: NoteGridProps) {
  /** どのカードの移動先メニューが開いているか。anchor は押されたボタンそのもの */
  const [moveFor, setMoveFor] = useState<{ noteId: string; folderId: string | null } | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const closeMove = useCallback(() => setMoveFor(null), []);

  const requestMove = (noteId: string, folderId: string | null, anchor: HTMLElement) => {
    // 同じカードをもう一度押したら閉じる
    setMoveFor((prev) => {
      if (prev?.noteId === noteId) return null;
      anchorRef.current = anchor;
      return { noteId, folderId };
    });
  };

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
    if (totalCount === 0) {
      return (
        <EmptyState
          icon={<NotebookPen size={26} style={{ color: 'var(--dc-primary)' }} />}
          title="最初のノートをつくりましょう"
          body="学んだことを自分の言葉で残せます。"
          action={<PrimaryAction onClick={onCreate} />}
        />
      );
    }
    if (!hasOtherFilters && filter.kind === 'folder') {
      // 🔴 「カードから移せます」だけでは足りない。いま開いているのが空のフォルダなので、
      //    この画面には移動元のカードが1枚も無い。戻る場所まで言う。
      return (
        <EmptyState
          icon={<FolderOpen size={26} style={{ color: 'var(--dc-primary)' }} />}
          title="このフォルダにはまだノートがありません"
          body="ここで作るか、「すべてのノート」に戻って、カード下のフォルダ名から移せます。"
          action={<PrimaryAction onClick={onCreate} />}
        />
      );
    }
    if (!hasOtherFilters && filter.kind === 'inbox') {
      return (
        <EmptyState
          icon={<Inbox size={26} style={{ color: 'var(--dc-text-subtle)' }} />}
          title="未整理のノートはありません"
          body="教材のクリップやAIの回答を保存すると、まずここに入ります。"
          action={null}
        />
      );
    }
    if (!hasOtherFilters && filter.kind === 'favorite') {
      return (
        <EmptyState
          icon={<Star size={26} style={{ color: 'var(--dc-primary)' }} />}
          title="重要にしたノートはありません"
          body="一覧のカード右上の★を押すと、ここに集まります。"
          action={null}
        />
      );
    }
    return (
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
    <>
      <div className="notes-grid">
        {items.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            folderName={folderNameOf(note.folderId, folders)}
            menuOpen={moveFor?.noteId === note.id}
            onOpen={onOpen}
            onToggleFavorite={onToggleFavorite}
            onRequestMove={requestMove}
          />
        ))}
      </div>

      <AnchoredMenu anchorRef={anchorRef} open={moveFor !== null} onClose={closeMove} minWidth={220}>
        <div
          style={{
            padding: '4px 10px 6px',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--dc-text-subtle)',
            letterSpacing: '.04em',
          }}
        >
          移動先
        </div>
        {[{ id: null as string | null, name: INBOX_LABEL }, ...folders].map((f) => (
          <button
            key={f.id ?? 'inbox'}
            type="button"
            role="menuitemradio"
            aria-checked={f.id === moveFor?.folderId}
            className={`notes-menu-item ${f.id === moveFor?.folderId ? 'is-selected' : ''}`}
            onClick={() => {
              const target = moveFor;
              closeMove();
              if (target && f.id !== target.folderId) onMove(target.noteId, f.id);
            }}
          >
            {f.id === null ? <Inbox size={14} /> : <Folder size={14} />}
            {f.name}
          </button>
        ))}
      </AnchoredMenu>
    </>
  );
}

function PrimaryAction({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
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
      <Plus size={17} /> 新しいノート
    </button>
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
  action: React.ReactNode | null;
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
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

export default NoteGrid;
