import { t } from '../../theme/tokens';
import { GalleryCourse, statusBadge, thumbTheme } from './courseVisuals';

/**
 * 「すべてのコースから探す」の4列タイル。
 *
 * 一覧は絞り込みよりも「並んだ絵柄を眺めて選ぶ」を優先するので、
 * カード1枚の情報は 16:9のサムネ・受講状況・所要時間・コース名・レッスン数だけに絞る。
 * 進捗バーはここには出さない（受講中コースの進捗はヒーローと「ほかに学習中」で見せる）。
 */

export function CourseTile({ course, onClick }: { course: GalleryCourse; onClick: () => void }) {
  const badge = statusBadge(course);
  const theme = thumbTheme(course.id);

  return (
    <div
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      role="button"
      tabIndex={0}
      className="cursor-pointer focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
      style={{
        background: t.color.bg.card,
        border: course.isCurrent ? `1.5px solid ${t.color.primaryBorder}` : `1px solid ${t.color.border.card}`,
        borderRadius: t.radius.tile,
        overflow: 'hidden',
        boxShadow: t.shadow.card,
        boxSizing: 'border-box',
      }}
    >
      {/* サムネ。画像を持つコースは画像、無ければカテゴリ名＋コース名を大きく組んで絵柄にする */}
      <div style={{ position: 'relative', aspectRatio: '16 / 9', background: theme.bg, overflow: 'hidden' }}>
        {course.thumbnailUrl ? (
          <img src={course.thumbnailUrl} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 16px', boxSizing: 'border-box' }}>
            <div style={{ fontSize: 12, fontWeight: t.font.weight.bold, color: theme.sub, letterSpacing: '.04em' }}>
              {course.categoryName}
            </div>
            <div
              style={{
                fontSize: 19, fontWeight: t.font.weight.black, color: theme.fg, lineHeight: 1.25, letterSpacing: '-.01em',
                display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden',
              }}
            >
              {course.title}
            </div>
          </div>
        )}

        {/* 地色は必ず白にする。バッジの淡い地色のままだとクリーム系のサムネに溶けて読めない */}
        <span
          style={{
            position: 'absolute', top: 10, right: 10,
            background: t.color.bg.card, color: badge.style.color,
            fontSize: 10, fontWeight: t.font.weight.bold, borderRadius: t.radius.pill, padding: '3px 9px',
            pointerEvents: 'none',
          }}
        >
          {badge.label}
        </span>

        {course.duration && (
          <span
            style={{
              position: 'absolute', bottom: 8, right: 10,
              fontSize: 10, fontWeight: t.font.weight.bold, color: '#fff', background: 'rgba(0,0,0,.55)',
              borderRadius: 6, padding: '2px 7px', pointerEvents: 'none',
            }}
          >
            {course.duration}
          </span>
        )}
      </div>

      <div style={{ padding: '11px 14px 13px' }}>
        {/* サムネにコース名を組んでいる場合は、その真下でもう一度同じ名前を出さない。
            画像サムネのコースだけ、ここが唯一の名前になる。 */}
        {course.thumbnailUrl && (
          <div
            style={{
              fontSize: 13.5, fontWeight: t.font.weight.black, lineHeight: 1.45,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              marginBottom: 6,
            }}
          >
            {course.title}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: t.color.text.subtle }}>
            {course.totalLessons ? `全${course.totalLessons}レッスン` : ''}
          </span>
          <span
            className="flex items-center justify-center flex-shrink-0"
            style={{ width: 22, height: 22, borderRadius: '50%', background: t.color.primarySoft }}
            aria-hidden
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={t.color.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

export default CourseTile;
