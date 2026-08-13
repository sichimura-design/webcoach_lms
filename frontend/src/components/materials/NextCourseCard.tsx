import { t } from '../../theme/tokens';
import { categoryColor } from './CourseCard';
import type { NextSlot } from '../../utils/nextCourseRecommend';

/**
 * 「次におすすめ」のカード。
 *
 * 一覧の CourseCard より情報量を落としてある。ここで見せたいのは
 * 「どのコースか」ではなく「なぜこれが次なのか」で、それは左上のバッジが担う。
 * 進捗バーや受講状況を出さないのは、推薦されるのが未受講のコースだけだから。
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
        borderRadius: t.radius.card,
        padding: '18px 22px 16px',
        boxShadow: t.shadow.card,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          alignSelf: 'flex-start',
          background: slotStyle.bg,
          color: slotStyle.fg,
          fontSize: 10.5,
          fontWeight: t.font.weight.black,
          borderRadius: 6,
          padding: '4px 10px',
        }}
      >
        {label}
      </span>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <span
          aria-hidden
          className="flex-shrink-0"
          style={{
            width: 44,
            height: 44,
            borderRadius: t.radius.inner,
            background: slotStyle.bg,
            border: `1px solid ${t.color.border.card}`,
          }}
        />
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 14.5, fontWeight: t.font.weight.black, lineHeight: 1.45 }}>
            {course.title}
          </div>
          {course.description && (
            <div style={{ fontSize: 11.5, color: t.color.text.muted, lineHeight: 1.6 }}>
              {course.description}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1 }} />
      <div style={{ height: 1, background: t.color.border.card }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11.5, color: t.color.text.subtle }}>{meta}</span>
        <span
          style={{
            fontSize: 12,
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
