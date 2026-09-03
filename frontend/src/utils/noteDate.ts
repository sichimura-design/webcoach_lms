/**
 * 学習メモの日時表示。
 *
 * 🔴 API（GET /api/webcoach/study-note/...）が返す updated_at は
 *    タイムゾーンの情報を持たない文字列（"2026-08-19T14:11:00"）。
 *    MySQL の TIMESTAMP を FastAPI がそのまま出しているためで、
 *    new Date() に渡すとブラウザは**ローカル時刻**として読む。
 *    DB セッションが UTC なら JST では9時間ずれる。
 *
 *    そこで、オフセットが書かれていない文字列は UTC として解釈する。
 *    実機で実際の時刻とずれていたら API_TIMESTAMP_IS_UTC を false にすれば戻る。
 *
 *    なお「保存しました HH:MM」にはこの値を使わない。保存が成功した時点の
 *    クライアント時計を使う。作業中に見ている時刻がずれないようにするため、
 *    サーバの値は初回表示の「最終更新」だけに使っている。
 */

/** オフセットの無い日時文字列を UTC と見なすか */
const API_TIMESTAMP_IS_UTC = true;

const HAS_TIMEZONE = /(?:Z|[+-]\d{2}:?\d{2})$/;

/** API の日時文字列を Date にする。読めなければ null */
export function parseApiTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const normalized = value.indexOf(' ') >= 0 ? value.replace(' ', 'T') : value;
  const withZone =
    API_TIMESTAMP_IS_UTC && !HAS_TIMEZONE.test(normalized) ? `${normalized}Z` : normalized;
  const date = new Date(withZone);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 23:11 */
export function formatNoteTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** 08/19。ただし今年でなければ 2025/08/19 と年も出す */
export function formatNoteDateShort(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return sameYear ? `${month}/${day}` : `${date.getFullYear()}/${month}/${day}`;
}

/** 08/19 23:11 */
export function formatNoteStamp(date: Date): string {
  return `${formatNoteDateShort(date)} ${formatNoteTime(date)}`;
}
