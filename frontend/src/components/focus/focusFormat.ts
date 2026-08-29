/**
 * 集中ブースの表示書式。
 */

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** 45分 / 1時間30分 */
export function formatMinutesHM(min: number): string {
  const safe = Math.max(0, Math.round(min));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h > 0) return m > 0 ? `${h}時間${m}分` : `${h}時間`;
  return `${m}分`;
}

/** M:SS。ポモドーロの残り時間 */
export function formatMMSS(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** H:MM:SS。通常タイマーの経過時間(1時間を超えても読める) */
export function formatHMS(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** 8月4日（月） */
export function formatDayLabel(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
}

/** 21:05 */
export function formatTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 8月4日 21:05 */
export function formatDayTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${formatDayLabel(d)} ${formatTime(d)}`;
}

/** 8月4日（月） 21:05 〜 21:52 */
export function formatSessionRange(startIso: string, endIso: string): string {
  return `${formatDayLabel(startIso)} ${formatTime(startIso)} 〜 ${formatTime(endIso)}`;
}

/** 2026年8月4日（月） — ページヘッダの日付行 */
export function formatTodayLabel(d: Date = new Date()): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
}

/** 2026年8月 — カレンダーの見出し(month: 0=1月) */
export function formatMonthLabel(year: number, month: number): string {
  return `${year}年${month + 1}月`;
}
