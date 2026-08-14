import { t } from '../../theme/tokens';
import { categoryColor } from './CourseCard';
import type { NextSlot } from '../../utils/nextCourseRecommend';

/**
 * 「次におすすめ」のカード。
 *
 * 一覧の CourseCard より情報量を落としてある。ここで見せたいのは
 * 「どのコースか」ではなく「なぜこれが次なのか」で、それは左上のバッジが担う。
 * 進捗バーや受講状況を出さないのは、推薦されるのが未受講のコースだけだから。
 *
 * サイズも一覧のカードより一段小さい。この節はページの主役ではなく、
 * 大きく出すとファーストビューが「続きから」＋「おすすめ」で埋まってしまうため
 * （レビュー指摘）、説明は1行に切って高さを抑える。
 */

const SLOT_STYLE: Record<NextSlot, { fg: string; bg: string }> = {
  practice: t.color.recommendSlot.practice,
  related: t.color.recommendSlot.related,
  ahead: t.color.recommendSlot.ahead,
};

export interface NextCourseCardCourse {
  id: number;
  title: string;
  description?: string;
  categoryName?: string;
  totalLessons?: number;
  duration?: string;
}

export function NextCourseCard({
  slot,
  label,
  course,
  onClick,
}: {
  slot: NextSlot;
  label: string;
  course: NextCourseCardCourse;
  onClick: () => void;
}) {
  const slotStyle = SLOT_STYLE[slot];
  const meta = [course.totalLessons ? `全${course.totalLessons}レッスン` : null, course.duration]
    .filter(Boolean)
    .join('・');

  return (
    <div
      onClick={onClick}
      className="cursor-pointer"
      style={{
        background: t.color.bg.card,
        border: `1px solid ${t.color.border.card}`,
        borderRadius: t.radius.inner,
        padding: '13px 16px 11px',
        boxShadow: t.shadow.card,
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
        <span
          aria-hidden
          className="flex-shrink-0"
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: slotStyle.bg,
            border: `1px solid ${t.color.border.card}`,
          }}
        />
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* バッジはタイトルの上に小さく置く。カード全体が低くなったので、
              単独の行にすると1行ぶんの高さが無駄になる */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span
              style={{
                background: slotStyle.bg,
                color: slotStyle.fg,
                fontSize: 10,
                fontWeight: t.font.weight.black,
                borderRadius: 5,
                padding: '2px 7px',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
            <div style={{ fontSize: 13.5, fontWeight: t.font.weight.black, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {course.title}
            </div>
          </div>
          {course.description && (
            <div style={{ fontSize: 11, color: t.color.text.muted, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {course.description}
            </div>
          )}
        </div>
      </div>

      {/* 説明が無いコースが混ざっても、区切り線と下段の位置を3枠でそろえる */}
      <div style={{ flex: 1 }} />
      <div style={{ height: 1, background: t.color.border.card }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: t.color.text.subtle }}>{meta}</span>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: t.font.weight.black,
            color: categoryColor(course.categoryName),
            whiteSpace: 'nowrap',
          }}
        >
          →
        </span>
      </div>
    </div>
  );
}

export default NextCourseCard;
