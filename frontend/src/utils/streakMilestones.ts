/**
 * 連続学習日数（ストリーク）の節目と、励ましの一言。すべて副作用のない純関数。
 * ============================================================
 * 「あと何日で次の節目か」を出すためだけの薄いモジュール。
 * 日数そのものの算出は utils/studyStats.ts の computeStreak が唯一の実装で、
 * ここはその結果を「次の目標」に変換するだけ。
 *
 * 節目を保存しないのは、しきい値が運用しながら変わるため。
 * 保存すると、条件を変えたときに過去分と食い違い、
 * 「昔の基準で付いた達成」と「今の基準」が混在して説明できなくなる。
 * 導出なら条件を変えた瞬間に全員の表示が揃う。
 *
 * 元は utils/achievements.ts として「最近の達成」カードの導出も持っていたが、
 * マイページの情報量を削るときにカード自体を廃止したため、
 * 残った機能に合わせてファイル名も変えた。
 * ============================================================
 */

/** 連続学習日数の節目。ここを増やすと自動で次の目標になる */
export const STREAK_MILESTONES = [3, 5, 7, 14, 21, 30, 60, 100];

/** 次に狙えるしきい値。すべて達成済みなら null */
export function nextMilestone(value: number, milestones: number[]): number | null {
  for (const m of milestones) {
    if (value < m) return m;
  }
  return null;
}

/** 次に狙える連続日数 */
export function nextStreakMilestone(currentDays: number): number | null {
  return nextMilestone(currentDays, STREAK_MILESTONES);
}

/**
 * 連続日数に応じた励ましの一言。
 * 数字を繰り返すのではなく言葉で返す（数字はカード側が出している）。
 */
export function streakMessage(currentDays: number, todayAchieved: boolean): string {
  if (currentDays === 0) return '今日から始めましょう。10分でも記録に残ります 🌱';
  if (!todayAchieved) return '今日もう少し学習すると、連続記録が伸びます 🔥';
  if (currentDays >= 30) return 'ここまで続けられるのは本当にすごいことです 🏆';
  if (currentDays >= 7) return '1週間以上つづいています！習慣になってきましたね ✨';
  if (currentDays >= 3) return '素晴らしいペースです！この調子で続けましょう 🔥';
  return 'いいスタートです。明日もつづけましょう 🌟';
}
