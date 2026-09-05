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

/**
 * カードのフッター用の短い日付。例: 08/19
 * デザイン『マイノート 改善案』はフッターにフォルダ名が入るので、年を省いて幅を空ける
 * （CONTENTS §16-2 の 2026/08/19 からの意図的な変更）。
 * 年が今年でないものだけ 2025/08/19 と年を戻す。去年のメモが今年に見えると困る。
 */
export function formatNoteDateShort(iso: string, now: Date = new Date()): string {
  const d = parse(iso);
  if (!d) return '';
  const md = `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  return d.getFullYear() === now.getFullYear() ? md : `${d.getFullYear()}/${md}`;
}

/** 上部バーの保存状態に添える時刻。例: 23:11 */
export function formatNoteTime(iso: string): string {
  const d = parse(iso);
  if (!d) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ノート面のメタ行。例: 2026/08/19 07:41 */
export function formatNoteStamp(iso: string): string {
  const d = parse(iso);
  if (!d) return '';
  return `${formatNoteDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
