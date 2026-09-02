import type { CSSProperties, ReactNode } from 'react';
import { t } from '../../theme/tokens';
import { familyOf } from '../../constants/courseTaxonomy';

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

/** 領域の色は family 単位。10領域に10色を割らない理由は tokens.ts の category を参照 */
const paletteOf = (name?: string) => t.color.category[familyOf(name) ?? 'unknown'];

export function categoryColor(name?: string): string {
  return paletteOf(name).fg;
}

/** カテゴリ色を薄く敷いた地色。サムネの円と同じ考え方で使う */
export function categoryTint(name?: string): string {
  return paletteOf(name).bg;
}

/**
 * コースの図形サムネ。領域の family ごとに意味の分かる簡単な図形を描く
 * （create=図形の構成 / build=タグ / grow=吹き出し / career=書類 / ai=きらめき）。
 *
 * 領域名そのものではなく family で分けるのは、領域が10個あっても図形は5つで足りるため。
 * 領域名はタイルに文字で出るので、図形が担うのは family までの粗さでよい。
 *
 * @param radius 枠の角丸。既定は真円。角丸の四角で使いたい行（ほかに学習中）は数値で渡す
 */
export function CourseThumb({ categoryName, size = 64, radius }: { categoryName: string; size?: number; radius?: number }) {
  const color = categoryColor(categoryName);
  const inner = (() => {
    switch (familyOf(categoryName)) {
      case 'build':
        return (
          <g fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 12 L7 18 L13 24" />
            <path d="M23 12 L29 18 L23 24" />
            <path d="M20 9 L16 27" />
          </g>
        );
      case 'grow':
        return (
          <g>
            <path d="M9 22 L9 14 L16 14 L26 8 L26 28 L16 22 Z" fill={color} opacity=".85" />
            <path d="M12 22 L12 28 L16 28 L15 22 Z" fill={color} opacity=".55" />
          </g>
        );
      case 'career':
        return (
          <g>
            <rect x="8" y="12" width="20" height="15" rx="2.5" fill={color} opacity=".85" />
            <path d="M14 12 V10 a2 2 0 0 1 2-2 h4 a2 2 0 0 1 2 2 v2" fill="none" stroke={color} strokeWidth="2.4" />
            <rect x="8" y="17" width="20" height="2.4" fill="#fff" opacity=".85" />
          </g>
        );
      case 'ai':
        return (
          <g>
            <path d="M18 7 L20.4 15.6 L29 18 L20.4 20.4 L18 29 L15.6 20.4 L7 18 L15.6 15.6 Z" fill={color} opacity=".85" />
            <circle cx="27" cy="9" r="2.4" fill={color} opacity=".45" />
          </g>
        );
      default: // create（Webデザイン・動画編集）と未知の領域
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
  // subtle(#A29A9C) は白地でコントラストが足りない。バッジの文字なので一段濃い方を使う
  return { label: '未受講', style: { background: '#F4F1F1', color: t.color.text.secondary } };
}

/**
 * サムネの地色テーマ。コースIDから決定的に選ぶので、
 * 一覧を絞り込んでも同じコースは同じ色のまま並ぶ。
 */
const THUMB_THEMES = ['red', 'dark', 'cream'] as const;

/**
 * courseId をそのまま3で割ると、レッスン数（buildCourseStructure も courseId % 3）と
 * 完全に相関して「5レッスンのコースは必ずクリーム」になる。3で割ってからずらして切る。
 */
export function thumbTheme(courseId: number) {
  return t.color.thumb[THUMB_THEMES[Math.floor(Math.abs(courseId) / 3) % THUMB_THEMES.length]];
}

/**
 * コース1本の絵柄。画像を持つコースは画像、無ければ領域名＋コース名を大きく組む。
 *
 * 🔴 コース名を絵柄の中に組むのはただの装飾ではない。呼び出し側は
 *    「サムネがコース名を持っているか」で本文側のコース名を出し分けており
 *    （CourseTile / MaterialsTopPage の「前回学習したもの」）、同じ名前が
 *    上下に2回並ぶのを避けている。文字を消すとこの前提が崩れる。
 *
 * 枠の大きさ・角丸は呼び出し側が style で決める（一覧は 16:9、ヒーローは固定サイズ）。
 * バッジなど絵柄の上に重ねるものは children で渡す（内側は position:relative）。
 */
export function CourseArt({
  course,
  titleSize = 'var(--dc-fs-title)',
  style,
  children,
}: {
  course: Pick<GalleryCourse, 'id' | 'title' | 'categoryName' | 'thumbnailUrl'>;
  /** 文字組みサムネのコース名の大きさ。小さい枠に置くときだけ下げる */
  titleSize?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const theme = thumbTheme(course.id);

  return (
    <div style={{ position: 'relative', background: theme.bg, overflow: 'hidden', ...style }}>
      {course.thumbnailUrl ? (
        <img
          src={course.thumbnailUrl}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 16px', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 'var(--dc-fs-caption)', fontWeight: t.font.weight.semibold, color: theme.sub, letterSpacing: '.04em' }}>
            {course.categoryName}
          </div>
          <div
            style={{
              fontSize: titleSize, fontWeight: t.font.weight.bold, color: theme.fg, lineHeight: 'var(--dc-lh-heading)', letterSpacing: '-.01em',
              display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflow: 'hidden',
            }}
          >
            {course.title}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
