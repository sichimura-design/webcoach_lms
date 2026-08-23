/**
 * ノートの日時表記。
 *
 * 同じ整形が一覧（旧 NoteListPanel）と NoteEditor に二重にあったのを1本にした。
 * 表記は CONTENTS §16-2 No.08「一覧・メタは 2026/08/14」に合わせる。
 */

const pad = (n: number) => String(n).padStart(2, '0');

function parse(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 一覧カードの日付。例: 2026/08/19 */
export function formatNoteDate(iso: string): string {
  const d = parse(iso);
  if (!d) return '';
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/** ノート面のメタ行。例: 2026/08/19 07:41 */
export function formatNoteStamp(iso: string): string {
  const d = parse(iso);
  if (!d) return '';
  return `${formatNoteDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
