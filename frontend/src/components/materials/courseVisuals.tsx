import { t } from '../../theme/tokens';

/**
 * 学習コンテンツ一覧のコース表現を1か所にまとめたモジュール。
 *
 * 学習領域ごとの色・地色・ステータスバッジ・図形サムネは、
 * 一覧のタイルとヒーロー横の「ほかに学習中」の行の両方で同じものを使う。
 * カード本体の見た目（CourseTile）とは分けておき、カードの作り替えで
 * 色の対応表まで書き直さないようにする。
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
  /** コース画像。あればサムネに使う（無ければタイポグラフィのサムネを描く） */
  thumbnailUrl?: string;
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
export function categoryTint(name?: string): string {
  switch (name) {
    case 'Webデザイン': return '#FDEEEF';
    case 'コーディング': return '#FBF1DC';
    case 'マーケティング': return '#F2ECFC';
    case 'キャリア': return '#EAF6ED';
    default: return '#F4F1F1';
  }
}

/**
 * コースの図形サムネ。学習領域ごとに意味の分かる簡単な図形を描く
 * （デザイン=図形の構成 / コーディング=タグ / 集客=吹き出し / キャリア=書類）。
 *
 * @param radius 枠の角丸。既定は真円。角丸の四角で使いたい行（ほかに学習中）は数値で渡す
 */
export function CourseThumb({ categoryName, size = 64, radius }: { categoryName: string; size?: number; radius?: number }) {
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
      style={{ width: size, height: size, borderRadius: radius ?? '50%', background: categoryTint(categoryName) }}
      aria-hidden
    >
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 36 36">{inner}</svg>
    </span>
  );
}

/** 受講状況のバッジ。「進行中」は続きから再開できる1コースだけ */
export function statusBadge(course: Pick<GalleryCourse, 'isCurrent' | 'progress'>) {
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

/**
 * サムネの地色テーマ。コースIDから決定的に選ぶので、
 * 一覧を絞り込んでも同じコースは同じ色のまま並ぶ。
 */
const THUMB_THEMES = ['red', 'dark', 'cream'] as const;

export function thumbTheme(courseId: number) {
  return t.color.thumb[THUMB_THEMES[Math.abs(courseId) % THUMB_THEMES.length]];
}
