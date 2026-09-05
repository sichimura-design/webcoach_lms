import { useRef, useState } from 'react';
import { Files, Folder, FolderPlus, Inbox, MoreHorizontal, Pencil, Star, Trash2 } from 'lucide-react';
import { useDismissable } from '../../hooks/useDismissable';
import { NOTE_FOLDER_NAME_MAX, NoteFolder, NoteFolderFilter } from '../../types/notes';
import {
  ALL_LABEL,
  FAVORITE_LABEL,
  FolderCounts,
  INBOX_LABEL,
  NOTE_DRAG_TYPE,
  hasNoteDrag,
  sameFilter,
} from './folderRows';

/**
 * 一覧の左に立つフォルダ列（デザイン『マイノート 改善案』①）。
 *
 * Google ドライブと同じ「自分で決める入れ物」。下の種類チップ（自動で付くラベル）
 * とは軸が違うので、場所を分けて置く。
 *   すべてのノート ／ 重要 ／ ―― フォルダ… ／ ―― 未整理
 * 未整理は「とりあえず保存」の行き先。毎回フォルダを決めなくて済むようにする。
 *
 * 行は div にしてある。行全体（選ぶ）と右端の ⋮（名前を変える・削除）が別のボタンで、
 * button の中に button は置けないため。
 */
interface NoteFolderColumnProps {
  folders: NoteFolder[];
  counts: FolderCounts;
  active: NoteFolderFilter;
  onSelect: (filter: NoteFolderFilter) => void;
  /** 作成。成功したら呼び出し側がそのフォルダを選ぶ。失敗はトーストにして reject */
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (folder: NoteFolder) => void;
  /** カードがドロップされた。null は未整理へ */
  onDropNote: (noteId: string, folderId: string | null) => void;
}

/** フォルダ名を打つ欄。新規作成と名前の変更で共用 */
function NameInput({
  initial,
  placeholder,
  onCommit,
  onCancel,
}: {
  initial: string;
  placeholder: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  // blur と Enter が続けて走っても1回だけ確定する
  const doneRef = useRef(false);

  const commit = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const name = value.trim();
    if (!name || name === initial) onCancel();
    else onCommit(name);
  };
  const cancel = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onCancel();
  };

  return (
    <input
      autoFocus
      value={value}
      maxLength={NOTE_FOLDER_NAME_MAX}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        }
        if (e.key === 'Escape') cancel();
      }}
      className="notes-search-input"
      style={{
        flex: 1,
        minWidth: 0,
        height: 30,
        margin: '0 4px',
        padding: '0 8px',
        border: '1px solid var(--dc-soft-200)',
        borderRadius: 7,
        background: 'var(--dc-surface)',
        fontFamily: 'inherit',
        fontWeight: 500,
        color: 'var(--dc-text)',
        outline: 'none',
      }}
    />
  );
}

export function NoteFolderColumn({
  folders,
  counts,
  active,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onDropNote,
}: NoteFolderColumnProps) {
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  /** いまカードが乗っているドロップ先。'inbox' か フォルダID */
  const [dropKey, setDropKey] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useDismissable(menuRef, menuId !== null, () => setMenuId(null));

  const dropHandlers = (key: string, folderId: string | null) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!hasNoteDrag(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dropKey !== key) setDropKey(key);
    },
    onDragLeave: (e: React.DragEvent) => {
      // 子要素へ移っただけの leave は無視する
      if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
      if (dropKey === key) setDropKey(null);
    },
    onDrop: (e: React.DragEvent) => {
      if (!hasNoteDrag(e)) return;
      e.preventDefault();
      setDropKey(null);
      const noteId = e.dataTransfer.getData(NOTE_DRAG_TYPE);
      if (noteId) onDropNote(noteId, folderId);
    },
  });

  const rowClass = (filter: NoteFolderFilter, key?: string) =>
    [
      'notes-folder-row',
      sameFilter(active, filter) ? 'is-active' : '',
      key && dropKey === key ? 'is-drop-target' : '',
    ]
      .filter(Boolean)
      .join(' ');

  const Count = ({ n }: { n: number }) => (
    <span className="notes-folder-row__count dc-num">{n}</span>
  );

  return (
    <nav aria-label="フォルダ" className="notes-folder-col">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px 12px' }}>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: 'var(--dc-text)' }}>マイノート</div>
        <button
          type="button"
          title="新しいフォルダ"
          aria-label="新しいフォルダ"
          onClick={() => setCreating(true)}
          className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 26,
            height: 26,
            border: '1px solid var(--dc-border-strong)',
            borderRadius: 7,
            background: 'var(--dc-surface)',
            color: 'var(--dc-text-body)',
            cursor: 'pointer',
          }}
        >
          <FolderPlus size={14} />
        </button>
      </div>

      {/* すべて／重要はドロップ先にしない（入れ物ではなく見方なので） */}
      <div className={rowClass({ kind: 'all' })}>
        <button
          type="button"
          className="notes-folder-row__main focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          aria-current={active.kind === 'all' ? 'true' : undefined}
          onClick={() => onSelect({ kind: 'all' })}
        >
          <Files size={16} />
          <span className="notes-folder-row__label">{ALL_LABEL}</span>
          <Count n={counts.all} />
        </button>
      </div>
      <div className={rowClass({ kind: 'favorite' })}>
        <button
          type="button"
          className="notes-folder-row__main focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          aria-current={active.kind === 'favorite' ? 'true' : undefined}
          onClick={() => onSelect({ kind: 'favorite' })}
        >
          <Star size={16} fill="var(--dc-primary)" style={{ color: 'var(--dc-primary)' }} />
          <span className="notes-folder-row__label">{FAVORITE_LABEL}</span>
          <Count n={counts.favorite} />
        </button>
      </div>

      <div style={{ height: 1, background: 'var(--dc-border)', margin: '10px 10px' }} />
      <div
        style={{
          padding: '0 10px 4px',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--dc-text-subtle)',
          letterSpacing: '.04em',
        }}
      >
        フォルダ
      </div>

      {folders.map((folder) => {
        const filter: NoteFolderFilter = { kind: 'folder', id: folder.id };
        const renaming = renamingId === folder.id;
        return (
          <div key={folder.id} className={rowClass(filter, folder.id)} {...dropHandlers(folder.id, folder.id)}>
            {renaming ? (
              <>
                <Folder size={16} style={{ marginLeft: 10, flexShrink: 0 }} />
                <NameInput
                  initial={folder.name}
                  placeholder="フォルダ名"
                  onCommit={(name) => {
                    setRenamingId(null);
                    void onRename(folder.id, name);
                  }}
                  onCancel={() => setRenamingId(null)}
                />
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="notes-folder-row__main focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                  aria-current={sameFilter(active, filter) ? 'true' : undefined}
                  onClick={() => onSelect(filter)}
                >
                  <Folder size={16} />
                  <span className="notes-folder-row__label">{folder.name}</span>
                  <Count n={counts.byFolder[folder.id] ?? 0} />
                </button>
                <div ref={menuId === folder.id ? menuRef : undefined} style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="notes-folder-row__more focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                    aria-label={`${folder.name}のメニュー`}
                    aria-haspopup="menu"
                    aria-expanded={menuId === folder.id}
                    onClick={() => setMenuId((v) => (v === folder.id ? null : folder.id))}
                  >
                    <MoreHorizontal size={15} />
                  </button>
                  {menuId === folder.id && (
                    <div role="menu" className="notes-menu" style={{ top: 30, right: 0 }}>
                      <button
                        type="button"
                        role="menuitem"
                        className="notes-menu-item"
                        onClick={() => {
                          setMenuId(null);
                          setRenamingId(folder.id);
                        }}
                      >
                        <Pencil size={14} /> 名前を変更
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="notes-menu-item is-danger"
                        onClick={() => {
                          setMenuId(null);
                          onDelete(folder);
                        }}
                      >
                        <Trash2 size={14} /> フォルダを削除
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}

      {creating && (
        <div className="notes-folder-row">
          <Folder size={16} style={{ marginLeft: 10, flexShrink: 0, color: 'var(--dc-text-muted)' }} />
          <NameInput
            initial=""
            placeholder="新しいフォルダの名前"
            onCommit={(name) => {
              setCreating(false);
              void onCreate(name);
            }}
            onCancel={() => setCreating(false)}
          />
        </div>
      )}

      {folders.length === 0 && !creating && (
        <div style={{ padding: '6px 10px 4px', fontSize: 12, lineHeight: 1.7, color: 'var(--dc-text-subtle)' }}>
          まだフォルダがありません。右上の
          <FolderPlus size={12} style={{ verticalAlign: '-2px', margin: '0 3px' }} />
          から作れます。
        </div>
      )}

      <div style={{ height: 1, background: 'var(--dc-border)', margin: '10px 10px' }} />

      <div className={rowClass({ kind: 'inbox' }, 'inbox')} {...dropHandlers('inbox', null)}>
        <button
          type="button"
          className="notes-folder-row__main focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          aria-current={active.kind === 'inbox' ? 'true' : undefined}
          onClick={() => onSelect({ kind: 'inbox' })}
        >
          <Inbox size={16} />
          <span className="notes-folder-row__label">{INBOX_LABEL}</span>
          <Count n={counts.inbox} />
        </button>
      </div>

      <div style={{ flex: 1 }} />
      <div
        style={{
          padding: 10,
          fontSize: 11,
          lineHeight: 1.7,
          color: 'var(--dc-text-subtle)',
          borderTop: '1px solid var(--dc-border)',
        }}
      >
        カードをフォルダにドラッグすると移動します。
      </div>
    </nav>
  );
}

export default NoteFolderColumn;
