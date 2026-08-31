/**
 * frontend/src/utils/lessonProgress.ts
 * コースの進み具合を「％」ではなく「4 / 9」（＝9レッスン中4レッスン完了）で見せるための変換。
 *
 * なぜ分数にするか:
 *   ％は読んだあとに母数を掛け直さないと「あと何本残っているか」が分からない。
 *   一覧で複数コースを見比べる画面では、その暗算をコースの数だけ強いることになる。
 *   分数なら「あと5本」が引き算1回で出るので、認知の負荷が下がる。
 *
 * 前提: 実データが持っているのは進捗率（progress）とレッスン総数（totalLessons）だけで、
 * 完了本数そのものは大半の画面に来ない。そこで率から本数を復元する。
 * 率は元々「完了数 ÷ 総数」で作られているので、四捨五入すれば元の本数に戻る。
 * ただし率と総数の数え方がズレている場合（追跡対象外のレッスンがある等）は
 * 1本ぶん食い違うことがあるため、正確な完了数を持っている画面
 * （CourseTopPage）は lessonProgressOf を直接使うこと。
 */

import { LEARNING_HIERARCHY } from '../constants/learningTaxonomy';

export interface LessonProgress {
  /** 完了したレッスン数 */
  done: number;
  /** コースの全レッスン数 */
  total: number;
  /** 「4 / 9」。数字の脇に単位を置ける狭い場所で使う */
  short: string;
  /** 「9レッスン中 4レッスン完了」。aria-label や説明文で使う */
  full: string;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** 完了本数が分かっている画面用。done は total を超えないように丸める */
export function lessonProgressOf(done: number, total: number): LessonProgress {
  const t = Math.max(0, Math.round(total));
  const d = clamp(Math.round(done), 0, t);
  const unit = LEARNING_HIERARCHY.lesson;
  return {
    done: d,
    total: t,
    short: `${d} / ${t}`,
    full: `${t}${unit}中 ${d}${unit}完了`,
  };
}

/**
 * 進捗率＋レッスン総数から分数を作る。
 * 総数が分からないコースは分数にできないので null を返す。
 * 呼び出し側は null のときだけ従来どおり％にフォールバックする。
 */
export function lessonProgressFromPercent(
  progress: number | undefined,
  totalLessons: number | undefined,
): LessonProgress | null {
  if (!totalLessons || totalLessons <= 0) return null;
  const pct = clamp(progress ?? 0, 0, 100);
  return lessonProgressOf((pct / 100) * totalLessons, totalLessons);
}
