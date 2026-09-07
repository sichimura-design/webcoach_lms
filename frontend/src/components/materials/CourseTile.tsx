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
      {/* サムネ。画像を持つコースは画像、無ければコース名を大きく組んで絵柄にする
          （絵柄そのものは courseVisuals の CourseArt。ヒーローと同じものを使う）
          🔴 比率は1枚の幅と釣り合わせる。狙いは「絵柄として成立する高さ（約180px）」に
             対して「中身の量（1〜3行のコース名）」が薄く見えないこと。
             学習トップが3列だった頃（1枚 約447px）は 16:9 が約250pxになって
             淡い地色の空白が広く残ったので 5:2 に落としていたが、いまは
             学習トップ4列で約320px、領域ページ3列で約328px の2択なので、
             16:9 がちょうど約180px になる。5:2 のままだと約130pxの細い帯。
          🔴 コース名は3行まで許す（titleLines）。4列の最小幅では2行だと
             最長のコース名が末尾を落とし、画像を持たないコースは本文側にも
             名前が出ないので、名前がどこにも残らなくなる。 */}
      <CourseArt course={course} titleLines={3} style={{ aspectRatio: '16 / 9' }}>
        {/* 🔴 「未受講」ではバッジを出さない。何もしていない既定の状態にラベルを
               貼ると、一覧の大半（55コース中ほとんど）が同じ札で埋まる。
               手を付けたコースだけが目印を持つ方が、目で拾える。
            地色は必ず白にする。バッジの淡い地色のままだと淡いサムネに溶けて読めない。
            角丸は pill ではなく badge(5px)。押せない状態ラベルなので四角い側に揃える。 */}
        {(course.isCurrent || course.progress > 0) && (
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          {/* 🔴 レッスン数と所要時間は1行にまとめる。所要時間はサムネの上に
                 黒いバッジで重ねていたが、絵柄の邪魔をするうえ、同じ「このコースの
                 大きさ」を語る数字が2か所に散っていた。 */}
          <span style={{ fontSize: 'var(--dc-fs-caption)', color: t.color.text.subtle, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[course.totalLessons && `全${course.totalLessons}レッスン`, course.duration].filter(Boolean).join('・')}
          </span>
          {/* 🔴 行末は「コースを見る ›」の文字をやめて › だけにした。押せるのは
                 タイル全体なので、同じ誘い文句が一覧のタイル数ぶん並ぶ必要が無い。
                 色とホバーは index.css の .course-tile-more が持つ。 */}
          <span className="course-tile-more inline-flex items-center flex-shrink-0" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

export default CourseTile;
