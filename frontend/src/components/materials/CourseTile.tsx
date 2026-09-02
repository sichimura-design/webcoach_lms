import { t } from '../../theme/tokens';
import { CourseArt, GalleryCourse, statusBadge } from './courseVisuals';
import { isCompleted } from './courseFilters';

/**
 * コース一覧のタイル。
 *
 * 一覧は絞り込みよりも「並んだ絵柄を眺めて選ぶ」を優先するので、
 * カード1枚の情報は 16:9のサムネ・受講状況・所要時間・コース名・レッスン数だけに絞る。
 * 進捗バーはここには出さない（受講中コースの進捗はヒーローと「ほかに学習中」で見せる）。
 *
 * 🔴 修了したコースは淡く沈める。一覧から消さないのは「もう一度見返す」ができなく
 *    なるため。消したい人は学習トップの「修了を隠す」で外せる。
 */

export function CourseTile({ course, onClick }: { course: GalleryCourse; onClick: () => void }) {
  const badge = statusBadge(course);
  const done = isCompleted(course);

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      role="button"
      tabIndex={0}
      className={`course-tile cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F6B9BD]${done ? ' is-done' : ''}`}
      style={{
        background: t.color.bg.card,
        border: course.isCurrent ? `1.5px solid ${t.color.primaryBorder}` : `1px solid ${t.color.border.card}`,
        borderRadius: t.radius.tile,
        overflow: 'hidden',
        boxShadow: t.shadow.card,
        boxSizing: 'border-box',
      }}
    >
      {/* サムネ。画像を持つコースは画像、無ければカテゴリ名＋コース名を大きく組んで絵柄にする
          （絵柄そのものは courseVisuals の CourseArt。ヒーローと同じものを使う） */}
      <CourseArt course={course} style={{ aspectRatio: '16 / 9' }}>
        {/* 地色は必ず白にする。バッジの淡い地色のままだとクリーム系のサムネに溶けて読めない。
            角丸は pill ではなく badge(5px)。押せない状態ラベルなので、
            すぐ下の所要時間バッジ（6px）と同じ「四角い＝読むだけ」の側に揃える。 */}
        <span
          style={{
            position: 'absolute', top: 10, right: 10,
            background: t.color.bg.card, color: badge.style.color,
            fontSize: 'var(--dc-fs-caption)', fontWeight: t.font.weight.semibold, borderRadius: t.radius.badge, padding: '3px 9px',
            pointerEvents: 'none',
          }}
        >
          {badge.label}
        </span>

        {course.duration && (
          <span
            style={{
              position: 'absolute', bottom: 8, right: 10,
              fontSize: 'var(--dc-fs-caption)', fontWeight: t.font.weight.semibold, color: '#fff', background: 'rgba(0,0,0,.55)',
              borderRadius: 6, padding: '2px 7px', pointerEvents: 'none',
            }}
          >
            {course.duration}
          </span>
        )}
      </CourseArt>

      <div style={{ padding: '11px 14px 13px' }}>
        {/* サムネにコース名を組んでいる場合は、その真下でもう一度同じ名前を出さない。
            画像サムネのコースだけ、ここが唯一の名前になる。 */}
        {course.thumbnailUrl && (
          <div
            style={{
              fontSize: 'var(--dc-fs-lead)', fontWeight: t.font.weight.semibold, lineHeight: 'var(--dc-lh-ui)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              marginBottom: 6,
            }}
          >
            {course.title}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 'var(--dc-fs-caption)', color: t.color.text.subtle }}>
            {course.totalLessons ? `全${course.totalLessons}レッスン` : ''}
          </span>
          {/* 行末は淡い丸ではなく文字にする。丸の地色は白カードの上で消えるうえ、
              押せるのはタイル全体なので「小さな丸ボタン」に見せる理由がない。
              色とホバーは index.css の .course-tile-more が持つ。 */}
          <span className="course-tile-more inline-flex items-center flex-shrink-0" style={{ gap: 3, fontSize: 'var(--dc-fs-body)', fontWeight: t.font.weight.semibold }} aria-hidden>
            コースを見る
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

export default CourseTile;
