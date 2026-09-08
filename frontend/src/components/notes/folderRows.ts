import type { DragEvent } from 'react';
import { NoteFolder, NoteFolderFilter, NoteSummary } from '../../types/notes';

/**
 * フォルダの行（バーのボタン・パネルの行・カード下部の移動先）が共有する計算と定数。
 * 出す場所は別々でも、並びとラベル、件数の数え方は1つにしておく。
 */

/** ノート面のブロックを掴んだとき（⠿）の dataTransfer の型 */
export const NOTE_BLOCK_DRAG_TYPE = 'application/x-wc-note-block';

export const INBOX_LABEL = '未整理';
export const ALL_LABEL = 'すべてのノート';
export const FAVORITE_LABEL = '重要';

export interface FolderCounts {
  all: number;
  favorite: number;
  inbox: number;
  byFolder: Record<string, number>;
}

/**
 * 一覧（検索・並び替え済みの全件）から各行の件数を数える。
 * 検索語が入っているときはその範囲の件数になる。グリッドに出る枚数と常に一致させるため。
 */
export function countByFolder(items: NoteSummary[]): FolderCounts {
  const counts: FolderCounts = { all: items.length, favorite: 0, inbox: 0, byFolder: {} };
  for (const n of items) {
    if (n.favorite) counts.favorite += 1;
    if (n.folderId === null) counts.inbox += 1;
    else counts.byFolder[n.folderId] = (counts.byFolder[n.folderId] ?? 0) + 1;
  }
  return counts;
}

export function folderNameOf(folderId: string | null, folders: NoteFolder[]): string | null {
  if (folderId === null) return null;
  return folders.find((f) => f.id === folderId)?.name ?? null;
}

export function sameFilter(a: NoteFolderFilter, b: NoteFolderFilter): boolean {
  if (a.kind !== b.kind) return false;
  return a.kind !== 'folder' || b.kind !== 'folder' || a.id === b.id;
}

/** dragover の時点では中身は読めないが型は読めるので、それで判定する */
export function hasBlockDrag(e: DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes(NOTE_BLOCK_DRAG_TYPE);
}
