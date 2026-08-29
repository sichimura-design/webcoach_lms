/**
 * 集中ブース／学習記録の表示書式。
 * 時間の書式（formatMinutesHM / formatMMSS / formatHMS）は集計と共有するので
 * utils/studyStats.ts が正本。ここは日付ラベルなど画面固有のものだけ置く。
 */
export { formatHMS, formatMMSS, formatMinutesHM } from '../../utils/studyStats';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

/** 8月4日（月） */
export function formatDayLabel(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
}

/** 8月4日 21:05 */
export function formatDayTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}

/** 21:05 */
export function formatTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 8月4日（月） 21:05 〜 21:52 */
export function formatSessionRange(startIso: string, endIso: string): string {
  return `${formatDayLabel(startIso)} ${formatTime(startIso)} 〜 ${formatTime(endIso)}`;
}

/** 2026年8月4日（月） — ページヘッダの日付行 */
export function formatTodayLabel(d: Date = new Date()): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAYS[d.getDay()]}）`;
}

/** 2026年8月 — カレンダーの見出し */
export function formatMonthLabel(year: number, month: number): string {
  return `${year}年${month + 1}月`;
}

/** グラフのX軸ラベル（8/4） */
export function formatShortDate(dateKey: string): string {
  const [, m, d] = dateKey.split('-');
  return `${Number(m)}/${Number(d)}`;
}
