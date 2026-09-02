import { Files, Folder, Inbox, Star } from 'lucide-react';
import { NoteFolder, NoteFolderFilter } from '../../types/notes';
import { ALL_LABEL, FAVORITE_LABEL, FolderCounts, INBOX_LABEL, sameFilter } from './folderRows';

/**
 * 狭い画面（1023px 以下）でフォルダ列の代わりに出す横並びのピル。
 * 並びは NoteFolderColumn と同じ（すべて／重要／フォルダ…／未整理）。
 * ドラッグ＆ドロップと作成・改名はここには無い。タッチ端末では HTML5 のドラッグが
 * 動かないので、移動はノート面のフォルダピルから行う。
 */
interface NoteFolderStripProps {
  folders: NoteFolder[];
  counts: FolderCounts;
  active: NoteFolderFilter;
  onSelect: (filter: NoteFolderFilter) => void;
}

export function NoteFolderStrip({ folders, counts, active, onSelect }: NoteFolderStripProps) {
  const pill = (filter: NoteFolderFilter, icon: React.ReactNode, label: string, count: number, key: string) => (
    <button
      key={key}
      type="button"
      aria-pressed={sameFilter(active, filter)}
      onClick={() => onSelect(filter)}
      className={`notes-folder-pill focus-visible:ring-2 focus-visible:ring-[#F6B9BD] ${
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

  return (
    <div className="notes-folder-strip" role="group" aria-label="フォルダ">
      {pill({ kind: 'all' }, <Files size={14} />, ALL_LABEL, counts.all, 'all')}
      {pill(
        { kind: 'favorite' },
        <Star size={14} fill="var(--dc-primary)" style={{ color: 'var(--dc-primary)' }} />,
        FAVORITE_LABEL,
        counts.favorite,
        'favorite'
      )}
      {folders.map((f) =>
        pill({ kind: 'folder', id: f.id }, <Folder size={14} />, f.name, counts.byFolder[f.id] ?? 0, f.id)
      )}
      {pill({ kind: 'inbox' }, <Inbox size={14} />, INBOX_LABEL, counts.inbox, 'inbox')}
    </div>
  );
}

export default NoteFolderStrip;
