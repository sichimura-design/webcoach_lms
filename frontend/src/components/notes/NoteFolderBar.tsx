import { useCallback, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Files,
  Folder,
  FolderPlus,
  Inbox,
  Pencil,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { NOTE_FOLDER_NAME_MAX, NoteFolder, NoteFolderFilter } from '../../types/notes';
import AnchoredMenu from './AnchoredMenu';
import { ALL_LABEL, FAVORITE_LABEL, FolderCounts, INBOX_LABEL, folderNameOf, sameFilter } from './folderRows';

/**
 * 一覧の上に立つフォルダのバー。以前の左フォルダ列（248px の NoteFolderColumn）と
 * 狭い画面用の横並びピル（NoteFolderStrip）を1つにしたもの。
 *
 * バー   … すべてのノート ／ 重要 ／ 未整理 ／「フォルダを開く ▾」
 * パネル … フォルダの選択と、作成・名前の変更・削除
 *
 * よく使う3つ（すべて・重要・未整理）は畳まずに出したままにする。フォルダは
 * 人によって数が増えるので、バーを押し出さないようパネルへ入れた。
 * フォルダと「種類」（出どころ）は別の軸として掛け合わさる。種類は自動で付く
 * ラベル、フォルダは手で選ぶ置き場所。未整理は「とりあえず保存」の行き先。
 *
 * 🔴 パネルの中で AnchoredMenu をもう1枚開かない（＝行の ⋯ メニューを作らない）。
 *    ポータルは親パネルの DOM の外に出るので、開いた瞬間に親の「外側クリック」判定に
 *    引っかかってパネルごと閉じる。名前の変更・削除は行の中の直ボタンにしてある。
 */
interface NoteFolderBarProps {
  folders: NoteFolder[];
  counts: FolderCounts;
  active: NoteFolderFilter;
  /** フォルダの読み込み中。?folder=<id> の直リンクでラベルをちらつかせないため */
  loading: boolean;
  onSelect: (filter: NoteFolderFilter) => void;
  /** 作成。成功したら呼び出し側がそのフォルダを選ぶ。失敗はトーストにして reject */
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (folder: NoteFolder) => void;
}

/**
 * フォルダ名を打つ欄。新規作成と名前の変更で共用。
 *
 * 🔴 blur では確定しない。確定は Enter か ✓ だけ、Esc とパネルの外を押したときは
 *    キャンセル。パネルは外側クリックで消える（unmount）が、React は unmount のときに
 *    blur を出さないので、blur 頼みにすると「名前を打って外を押す」で入力が黙って消える。
 */
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

  const commit = () => {
    const name = value.trim();
    if (!name || name === initial) onCancel();
    else onCommit(name);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0, margin: '0 6px' }}>
      <input
        autoFocus
        value={value}
        maxLength={NOTE_FOLDER_NAME_MAX}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          }
          if (e.key === 'Escape') {
            // 🔴 AnchoredMenu が document に張る keydown まで届くとパネルごと閉じる
            e.stopPropagation();
            onCancel();
          }
        }}
        className="notes-search-input"
        style={{
          flex: 1,
          minWidth: 0,
          height: 36,
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
      <button
        type="button"
        title="決定"
        aria-label="決定"
        onClick={commit}
        className="notes-folder-row__more is-shown focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{ color: 'var(--dc-primary)' }}
      >
        <Check size={16} />
      </button>
    </div>
  );
}

export function NoteFolderBar({
  folders,
  counts,
  active,
  loading,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: NoteFolderBarProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setCreating(false);
    setRenamingId(null);
  }, []);

  const pick = (filter: NoteFolderFilter) => {
    onSelect(filter);
    close();
  };

  const Count = ({ n }: { n: number }) => <span className="notes-folder-row__count dc-num">{n}</span>;

  /** バーのボタン。すべて／重要／未整理 */
  const barItem = (filter: NoteFolderFilter, icon: React.ReactNode, label: string, count: number) => (
    <button
      type="button"
      aria-pressed={sameFilter(active, filter)}
      onClick={() => onSelect(filter)}
      className={`notes-folder-bar__item focus-visible:ring-2 focus-visible:ring-[#F6B9BD] ${
        sameFilter(active, filter) ? 'is-active' : ''
      }`}
    >
      {icon}
      {label}
      <span className="dc-num" style={{ color: 'var(--dc-text-subtle)', fontSize: 11.5 }}>
        {count}
      </span>
    </button>
  );

  /** パネルの行。選ぶボタン＋（フォルダなら）名前の変更・削除 */
  const panelRow = (
    filter: NoteFolderFilter,
    icon: React.ReactNode,
    label: string,
    count: number,
    folder?: NoteFolder
  ) => {
    if (folder && renamingId === folder.id) {
      return (
        <div key={folder.id} className="notes-folder-row">
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
        </div>
      );
    }

    return (
      <div key={folder?.id ?? filter.kind} className={`notes-folder-row ${sameFilter(active, filter) ? 'is-active' : ''}`}>
        <button
          type="button"
          className="notes-folder-row__main focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          aria-current={sameFilter(active, filter) ? 'true' : undefined}
          onClick={() => pick(filter)}
        >
          {icon}
          <span className="notes-folder-row__label">{label}</span>
          <Count n={count} />
        </button>
        {folder && (
          <>
            <button
              type="button"
              title="名前を変更"
              aria-label={`${folder.name}の名前を変更`}
              onClick={() => setRenamingId(folder.id)}
              className="notes-folder-row__more focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              title="フォルダを削除"
              aria-label={`${folder.name}を削除`}
              onClick={() => {
                // 確認ダイアログの裏にパネルが残らないよう、先に閉じる
                close();
                onDelete(folder);
              }}
              className="notes-folder-row__more is-danger focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            >
              <Trash2 size={15} />
            </button>
          </>
        )}
      </div>
    );
  };

  /*
   * トリガーの文字。フォルダを開いているときだけその名前にする。
   * 🔴 filterLabel() は使わない。あれは重要・未整理も名前を返すので、
   *    バーに独立して出している2つと二重になる。
   * 🔴 ?folder=<id> を直に開いた瞬間は folders が空。名前が引けないうちは
   *    「フォルダ」で持ちこたえる（「フォルダを開く」に戻すとラベルがちらつく）。
   */
  const openFolderName = active.kind === 'folder' ? folderNameOf(active.id, folders) : null;
  const triggerLabel =
    active.kind === 'folder' ? openFolderName ?? (loading ? 'フォルダ' : '（削除されたフォルダ）') : 'フォルダを開く';

  return (
    <div className="notes-folder-bar" role="group" aria-label="フォルダ">
      {barItem({ kind: 'all' }, <Files size={14} />, ALL_LABEL, counts.all)}
      {barItem(
        { kind: 'favorite' },
        <Star size={14} fill="var(--dc-primary)" style={{ color: 'var(--dc-primary)' }} />,
        FAVORITE_LABEL,
        counts.favorite
      )}
      {barItem({ kind: 'inbox' }, <Inbox size={14} />, INBOX_LABEL, counts.inbox)}

      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className={`notes-folder-bar__item is-trigger focus-visible:ring-2 focus-visible:ring-[#F6B9BD] ${
          active.kind === 'folder' ? 'is-active' : ''
        } ${open ? 'is-open' : ''}`}
      >
        <Folder size={14} />
        <span className="notes-folder-bar__label">{triggerLabel}</span>
        {active.kind === 'folder' && openFolderName && (
          <span className="dc-num" style={{ color: 'var(--dc-text-subtle)', fontSize: 11.5 }}>
            {counts.byFolder[active.id] ?? 0}
          </span>
        )}
        <ChevronDown size={14} style={{ flexShrink: 0 }} />
      </button>

      <AnchoredMenu
        anchorRef={triggerRef}
        open={open}
        onClose={close}
        role="dialog"
        ariaLabel="フォルダ"
        manageFocus
      >
        {/* 🔴 画面より広くならないようにする。AnchoredMenu の左端クランプは
               幅が画面を超えると右側をはみ出させ、横スクロールを作る */}
        <div style={{ width: 'min(320px, calc(100vw - 44px))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px 8px' }}>
            <div style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'var(--dc-text-subtle)', letterSpacing: '.04em' }}>
              フォルダ
            </div>
            <button
              type="button"
              title="閉じる"
              aria-label="閉じる"
              onClick={close}
              className="notes-folder-row__more is-shown focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
            >
              <X size={16} />
            </button>
          </div>

          {/* すべて／重要は「入れ物」ではなく見方だが、ここが現在地の一覧でもあるので同じ並びに置く */}
          {panelRow({ kind: 'all' }, <Files size={16} />, ALL_LABEL, counts.all)}
          {panelRow(
            { kind: 'favorite' },
            <Star size={16} fill="var(--dc-primary)" style={{ color: 'var(--dc-primary)' }} />,
            FAVORITE_LABEL,
            counts.favorite
          )}

          <div style={{ height: 1, background: 'var(--dc-border)', margin: '8px 6px' }} />

          {folders.map((folder) =>
            panelRow(
              { kind: 'folder', id: folder.id },
              <Folder size={16} />,
              folder.name,
              counts.byFolder[folder.id] ?? 0,
              folder
            )
          )}

          {folders.length === 0 && !creating && (
            <div style={{ padding: '4px 10px 8px', fontSize: 12, lineHeight: 1.7, color: 'var(--dc-text-subtle)' }}>
              まだフォルダがありません。下から作れます。
            </div>
          )}

          {panelRow({ kind: 'inbox' }, <Inbox size={16} />, INBOX_LABEL, counts.inbox)}

          <div style={{ height: 1, background: 'var(--dc-border)', margin: '8px 6px' }} />

          {creating ? (
            <div className="notes-folder-row">
              <FolderPlus size={16} style={{ marginLeft: 10, flexShrink: 0, color: 'var(--dc-text-muted)' }} />
              <NameInput
                initial=""
                placeholder="新しいフォルダの名前"
                onCommit={(name) => {
                  setCreating(false);
                  setOpen(false);
                  void onCreate(name);
                }}
                onCancel={() => setCreating(false)}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="notes-menu-item focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{ color: 'var(--dc-primary)' }}
            >
              <FolderPlus size={15} /> 新しいフォルダを作成
            </button>
          )}
        </div>
      </AnchoredMenu>
    </div>
  );
}

export default NoteFolderBar;
