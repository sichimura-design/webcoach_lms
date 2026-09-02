import { useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  Folder,
  Inbox,
  Loader2,
  MoreHorizontal,
  Star,
  Trash2,
} from 'lucide-react';
import { useDismissable } from '../../hooks/useDismissable';
import { NoteSaveState } from '../../hooks/useNote';
import { Note, NoteFolder } from '../../types/notes';
import { formatNoteTime } from './noteDate';
import { INBOX_LABEL, folderNameOf } from './folderRows';

/**
 * ノート面の上部バー（デザイン『マイノート 改善案』②③④）。
 * 左＝戻る／保存先、右＝保存状態と操作。
 *
 *   ② フォルダピル … 保存先をここで変えられる（ドライブの「移動」に相当）
 *   ③ 保存状態     … 「保存しました 23:11」。以前は更新日しか手がかりが無かった
 *   ④ 重要         … ラベル付きのトグル。押した状態が塗りと文言で分かる
 *   「その他」     … 削除。カードから ⋮ を無くしたので、削除の入口はここだけ
 */
interface NoteEditorBarProps {
  note: Note;
  folders: NoteFolder[];
  saveState: NoteSaveState;
  onBack: () => void;
  /** 教材から来たときの「〈教材名〉に戻る」。無ければ出さない */
  backToSource: { label: string; onClick: () => void } | null;
  onMoveToFolder: (folderId: string | null) => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}

/** ② 保存先のピル。押すと 未整理＋フォルダ の一覧が開く */
function FolderPill({
  folderId,
  folders,
  onPick,
}: {
  folderId: string | null;
  folders: NoteFolder[];
  onPick: (folderId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismissable(ref, open, () => setOpen(false));

  const name = folderNameOf(folderId, folders);
  const inbox = folderId === null || name === null;

  const item = (id: string | null, label: string, icon: React.ReactNode) => (
    <button
      key={id ?? 'inbox'}
      type="button"
      role="menuitemradio"
      aria-checked={id === folderId}
      className={`notes-menu-item ${id === folderId ? 'is-selected' : ''}`}
      onClick={() => {
        setOpen(false);
        onPick(id);
      }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="保存先のフォルダを変える"
        onClick={() => setOpen((v) => !v)}
        className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          height: 30,
          padding: '0 12px',
          border: '1px solid var(--dc-border-strong)',
          borderRadius: 9999,
          background: open ? 'var(--dc-sunken)' : 'var(--dc-surface)',
          color: inbox ? 'var(--dc-primary)' : 'var(--dc-text-body)',
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          maxWidth: 260,
        }}
      >
        {inbox ? <Inbox size={13} /> : <Folder size={13} style={{ color: 'var(--dc-text-muted)' }} />}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {inbox ? INBOX_LABEL : name}
        </span>
        <ChevronDown size={13} style={{ color: 'var(--dc-text-muted)', flexShrink: 0 }} />
      </button>
      {open && (
        <div role="menu" className="notes-menu" style={{ top: 36, left: 0, minWidth: 220 }}>
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
          {item(null, INBOX_LABEL, <Inbox size={14} />)}
          {folders.map((f) => item(f.id, f.name, <Folder size={14} />))}
          {folders.length === 0 && (
            <p style={{ margin: '4px 10px 6px', fontSize: 12, lineHeight: 1.7, color: 'var(--dc-text-subtle)' }}>
              フォルダは一覧の左列で作れます。
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** ③ 保存状態。保存中 → 保存しました HH:MM → 失敗、の3つだけ */
function SaveStatus({ saveState, fallbackAt }: { saveState: NoteSaveState; fallbackAt: string }) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    color: 'var(--dc-text-muted)',
    whiteSpace: 'nowrap',
  };
  if (saveState.saving) {
    return (
      <span style={base} role="status" aria-live="polite">
        <Loader2 size={14} className="animate-spin" style={{ color: 'var(--dc-text-subtle)' }} />
        保存中…
      </span>
    );
  }
  if (saveState.error) {
    return (
      <span style={{ ...base, color: 'var(--dc-primary)' }} role="status" aria-live="polite">
        <AlertCircle size={14} />
        {saveState.error}
      </span>
    );
  }
  return (
    <span style={base} role="status" aria-live="polite">
      <Check size={14} style={{ color: '#2FA35C' }} strokeWidth={2.25} />
      保存しました
      <span className="dc-num" style={{ color: 'var(--dc-text-subtle)' }}>
        {formatNoteTime(saveState.lastSavedAt ?? fallbackAt)}
      </span>
    </span>
  );
}

export function NoteEditorBar({
  note,
  folders,
  saveState,
  onBack,
  backToSource,
  onMoveToFolder,
  onToggleFavorite,
  onDelete,
}: NoteEditorBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  useDismissable(moreRef, moreOpen, () => setMoreOpen(false));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={onBack}
        className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '6px 10px 6px 4px',
          border: 0,
          borderRadius: 8,
          background: 'none',
          color: 'var(--dc-primary)',
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        <ChevronLeft size={16} /> マイノートに戻る
      </button>

      {/* 戻り先は2つ出る。一覧へ戻るのと、来た教材へ帰るのは別の用事なので
          どちらかに寄せない（教材から見に来た人が一覧経由で帰らずに済む）。 */}
      {backToSource && (
        <button
          type="button"
          onClick={backToSource.onClick}
          className="notes-tool focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
          style={{ height: 30, maxWidth: 280 }}
        >
          <BookOpen size={14} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{backToSource.label}</span>
        </button>
      )}

      <FolderPill folderId={note.folderId} folders={folders} onPick={onMoveToFolder} />

      <span style={{ flex: 1 }} />

      <SaveStatus saveState={saveState} fallbackAt={note.updatedAt} />

      <button
        type="button"
        aria-pressed={note.favorite}
        onClick={onToggleFavorite}
        className={`notes-tool focus-visible:ring-2 focus-visible:ring-[#F6B9BD] ${note.favorite ? 'is-on' : ''}`}
      >
        <Star size={14} fill={note.favorite ? 'var(--dc-primary)' : 'none'} style={note.favorite ? { color: 'var(--dc-primary)' } : undefined} />
        {note.favorite ? '重要' : '重要にする'}
      </button>

      <div ref={moreRef} style={{ position: 'relative' }}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
          className="notes-tool focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        >
          <MoreHorizontal size={14} />
          その他
        </button>
        {moreOpen && (
          <div role="menu" className="notes-menu" style={{ top: 38, right: 0 }}>
            <button
              type="button"
              role="menuitem"
              className="notes-menu-item is-danger"
              onClick={() => {
                setMoreOpen(false);
                onDelete();
              }}
            >
              <Trash2 size={14} /> このノートを削除
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default NoteEditorBar;
