import { t } from '../../theme/tokens';

/**
 * 学習コンテンツ一覧のコースカード。
 *
 * 一覧は「絞り込んで探す」より「見出しごとに並んだギャラリーを眺めて選ぶ」を優先する。
 * そのためカードは1枚あたりの情報量を絞り、サムネ・タイトル・ひとこと説明・
 * 「どんな人向けか」のタグ・レッスン数だけを出す。
 */

export interface GalleryCourse {
  id: number;
  title: string;
  description: string;
  categoryName: string;
  /** 0-100。未受講は0 */
  progress: number;
  totalLessons?: number;
  duration?: string;
  /** 「未経験向け」「作品を作る」など。学習タイプ（基礎知識/実践課題）とは別 */
  purposes?: string[];
  /** いま「続きから」で再開できるコース */
  isCurrent: boolean;
}

export function categoryColor(name?: string): string {
  switch (name) {
    case 'Webデザイン': return t.color.category.design;
    case 'コーディング': return t.color.category.coding;
    case 'マーケティング': return t.color.category.marketing;
    case 'キャリア': return t.color.category.career;
    default: return t.color.text.subtle;
  }
}

/** カテゴリ色を薄く敷いた地色。サムネの円と同じ考え方で使う */
function categoryTint(name?: string): string {
  switch (name) {
    case 'Webデザイン': return '#FDEEEF';
    case 'コーディング': return '#FBF1DC';
    case 'マーケティング': return '#F2ECFC';
    case 'キャリア': return '#EAF6ED';
    default: return '#F4F1F1';
  }
}

/**
 * コースのサムネ。画像アセットを持たないので、学習領域ごとに意味の分かる
 * 簡単な図形を描く（デザイン=図形の構成 / コーディング=タグ / 集客=吹き出し / キャリア=書類）。
 */
function CourseThumb({ categoryName, size = 64 }: { categoryName: string; size?: number }) {
  const color = categoryColor(categoryName);
  const inner = (() => {
    switch (categoryName) {
      case 'コーディング':
        return (
          <g fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 12 L7 18 L13 24" />
            <path d="M23 12 L29 18 L23 24" />
            <path d="M20 9 L16 27" />
          </g>
        );
      case 'マーケティング':
        return (
          <g>
            <path d="M9 22 L9 14 L16 14 L26 8 L26 28 L16 22 Z" fill={color} opacity=".85" />
            <path d="M12 22 L12 28 L16 28 L15 22 Z" fill={color} opacity=".55" />
          </g>
        );
      case 'キャリア':
        return (
          <g>
            <rect x="8" y="12" width="20" height="15" rx="2.5" fill={color} opacity=".85" />
            <path d="M14 12 V10 a2 2 0 0 1 2-2 h4 a2 2 0 0 1 2 2 v2" fill="none" stroke={color} strokeWidth="2.4" />
            <rect x="8" y="17" width="20" height="2.4" fill="#fff" opacity=".85" />
          </g>
        );
      default: // Webデザイン
        return (
          <g>
            <rect x="8" y="9" width="12" height="12" rx="2.5" fill={color} opacity=".85" />
            <circle cx="25" cy="14" r="5.5" fill={color} opacity=".45" />
            <path d="M13 29 L19 20 L25 29 Z" fill={color} opacity=".65" />
          </g>
        );
    }
  })();

  return (
    <span
      className="flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, borderRadius: '50%', background: categoryTint(categoryName) }}
      aria-hidden
    >
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 36 36">{inner}</svg>
    </span>
  );
}

function statusBadge(course: GalleryCourse) {
  if (course.isCurrent) {
    return { label: '進行中', style: { background: t.color.primarySoft, color: t.color.primary } };
  }
  if (course.progress >= 100) {
    return { label: '修了', style: { background: t.color.successSoft, color: t.color.success } };
  }
  if (course.progress > 0) {
    return { label: '受講中', style: { background: t.color.primarySoft, color: t.color.primary } };
  }
  return { label: '未受講', style: { background: '#F4F1F1', color: t.color.text.subtle } };
}

export function CourseCard({ course, onClick }: { course: GalleryCourse; onClick: () => void }) {
  const badge = statusBadge(course);
  const started = course.progress > 0;
  const ctaLabel = course.progress >= 100 ? 'もう一度見る' : started ? '続きから' : 'はじめる';

  return (
    <div
      onClick={onClick}
      className="cursor-pointer"
      style={{
        background: t.color.bg.card,
        border: course.isCurrent ? `1.5px solid ${t.color.primaryBorder}` : `1px solid ${t.color.border.card}`,
        borderRadius: t.radius.card,
        padding: '20px 22px 18px',
        boxShadow: t.shadow.card,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minHeight: 218,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11.5, fontWeight: t.font.weight.black, color: categoryColor(course.categoryName) }}>
          {course.categoryName}
        </span>
        <span style={{ ...badge.style, fontSize: 10.5, fontWeight: t.font.weight.bold, borderRadius: t.radius.pill, padding: '3px 10px' }}>
          {badge.label}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <CourseThumb categoryName={course.categoryName} />
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 15, fontWeight: t.font.weight.black, lineHeight: 1.45 }}>{course.title}</div>
          <div style={{ fontSize: 11.5, color: t.color.text.muted, lineHeight: 1.65 }}>{course.description}</div>
        </div>
      </div>

      {course.purposes && course.purposes.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {course.purposes.slice(0, 2).map((p) => (
            <span
              key={p}
              style={{ background: categoryTint(course.categoryName), color: categoryColor(course.categoryName), fontSize: 10.5, fontWeight: t.font.weight.bold, borderRadius: 6, padding: '4px 9px' }}
            >
              {p}
            </span>
          ))}
        </div>
      )}

      <div style={{ flex: 1 }} />

      {started && course.progress < 100 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 5, borderRadius: t.radius.pill, background: t.color.progressTrack, overflow: 'hidden' }}>
            <div style={{ width: `${course.progress}%`, height: '100%', borderRadius: t.radius.pill, background: t.color.primary }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: t.font.weight.bold, color: t.color.primary, whiteSpace: 'nowrap' }}>
            進捗 {course.progress}%
          </span>
        </div>
      )}

      <div style={{ height: 1, background: t.color.border.card }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11.5, color: t.color.text.subtle }}>
          {[course.totalLessons ? `全${course.totalLessons}レッスン` : null, course.duration]
            .filter(Boolean)
            .join('・')}
        </span>
        <span style={{ fontSize: 12, fontWeight: t.font.weight.black, color: t.color.primary, whiteSpace: 'nowrap' }}>
          {ctaLabel}　→
        </span>
      </div>
    </div>
  );
}

export default CourseCard;
