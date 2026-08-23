/**
 * 次回コーチングの日程まわりの小さな共通処理。
 *
 * 🔴 「あと何日」は NextCoachingCard（マイページ）と CoachingHeroCard（/coaching）の
 *    両方が出す。かつて CoachingSummaryStrip にも同じ計算があり、3箇所で
 *    微妙に違う丸め方をしていたので、ここ1本に寄せた。
 */

/**
 * 残り日数。startsAt が無い（機械的に読めない）ときは null を返す。
 *
 * 表示用の日付文字列（「8月10日(月) 10:00〜11:00」）から日数を起こすと
 * 年をまたいだ瞬間に嘘の数字が出るため、機械可読な値が無いときは出さない。
 */
export function daysUntil(startsAt: string | null): number | null {
  if (!startsAt) return null;
  const target = new Date(startsAt);
  if (Number.isNaN(target.getTime())) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(target) - startOfDay(new Date())) / 86_400_000);
}

/** 「あと5日」。過ぎている・読めないときは null（＝そのピルごと出さない） */
export function untilLabel(startsAt: string | null): string | null {
  const d = daysUntil(startsAt);
  if (d === null || d < 0) return null;
  if (d === 0) return '今日';
  if (d === 1) return '明日';
  return `あと${d}日`;
}

const WEEKDAY = ['日', '月', '火', '水', '木', '金', '土'];

/** 'YYYY-MM-DD' → '8月12日（水）'。解釈できなければ元の文字列をそのまま返す */
export function formatSessionDate(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return date;
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAY[d.getDay()]}）`;
}
