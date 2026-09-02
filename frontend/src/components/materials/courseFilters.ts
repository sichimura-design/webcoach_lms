import type { CSSProperties } from 'react';
import { t } from '../../theme/tokens';
import type { GalleryCourse } from './courseVisuals';

/**
 * コース一覧の絞り込みで、学習トップ（MaterialsTopPage）と
 * 領域ページ（AreaCoursesPage）が共有するもの。
 *
 * 🔴 select の見た目をここに置く理由: もともと領域ページ側に
 *    「学習トップと同じ素の select」というコメント付きで定義されていた。
 *    学習トップにも絞り込みが戻ったので、同じ形を2回書かずに済むよう集約する。
 *
 * 種類（基礎/実践課題）と並び替えは領域ページだけが持つ。学習トップは
 * 領域ごとのブロックで並ぶので、全体の並び替えという概念が無い。
 */

/** プルダウンの「絞り込まない」を表す値。表示文字列をそのまま値に使う */
export const ALL = 'すべて';

/** 受講状況。progress と isCurrent から導出するので、追加のデータは要らない */
export const COURSE_STATUS = {
  inProgress: '学習中',
  notStarted: '未受講',
  completed: '修了',
} as const;

export type CourseStatus = (typeof COURSE_STATUS)[keyof typeof COURSE_STATUS];

export const COURSE_STATUSES: readonly CourseStatus[] = [
  COURSE_STATUS.inProgress,
  COURSE_STATUS.notStarted,
  COURSE_STATUS.completed,
];

type StatusSource = Pick<GalleryCourse, 'progress' | 'isCurrent'>;

/**
 * 修了したコース。
 * 🔴 判定は courseVisuals の statusBadge と同じ progress >= 100 に揃える。
 *    ここだけ別の閾値にすると、バッジは「修了」なのに絞り込みでは残る。
 */
export function isCompleted(course: Pick<GalleryCourse, 'progress'>): boolean {
  return course.progress >= 100;
}

export function courseStatusOf(course: StatusSource): CourseStatus {
  if (isCompleted(course)) return COURSE_STATUS.completed;
  // 「続きから」の1コース（isCurrent）は progress 0 でも学習中として扱う
  if (course.isCurrent || course.progress > 0) return COURSE_STATUS.inProgress;
  return COURSE_STATUS.notStarted;
}

/** 素の select。角丸は control(9px) で「その場で絞る」側の形 */
export const selectStyle: CSSProperties = {
  appearance: 'none',
  WebkitAppearance: 'none',
  background: `${t.color.bg.card} no-repeat right 12px center`,
  backgroundImage:
    'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%238A8082\' stroke-width=\'2.2\' stroke-linecap=\'round\'><path d=\'m6 9 6 6 6-6\'/></svg>")',
  border: `1px solid ${t.color.border.card}`,
  borderRadius: t.radius.control,
  padding: '7px 30px 7px 14px',
  fontSize: 'var(--dc-fs-body)',
  fontFamily: 'inherit',
  color: t.color.text.primary,
  cursor: 'pointer',
  outline: 'none',
};
