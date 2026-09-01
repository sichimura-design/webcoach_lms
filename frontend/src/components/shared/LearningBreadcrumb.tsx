import React, { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '../../theme/tokens';

/**
 * 学習コンテンツ系の画面で常に表示するパンくず。
 *
 * 出す階層は実際に存在する「学習コンテンツ ＞ 学習領域 ＞ コース ＞ 単元 ＞ レッスン」だけ。
 * 以前は先頭にサイドバーのグループ名「学習」が入っていたが、学習という階層は存在せず
 * リンク先も無いため取り除いた（constants/learningTaxonomy.ts の階層定義に合わせる）。
 *
 * 1行に収め、長いコース名・レッスン名は省略記号で切る。教材ページのトップバーでも
 * 同じ体裁で使うため、レイアウトは呼び出し側から style で微調整できるようにしている。
 */
export interface Crumb {
  label: string;
  /** クリックで遷移する先。最後の要素（現在地）に付けても無視する */
  to?: string;
  /** to では表せない戻り先（画面固有のハンドラ）を使いたいとき */
  onClick?: () => void;
}

interface LearningBreadcrumbProps {
  items: Crumb[];
  style?: React.CSSProperties;
}

export function LearningBreadcrumb({ items, style }: LearningBreadcrumbProps) {
  const navigate = useNavigate();
  const visible = items.filter((item) => item.label);
  if (visible.length === 0) return null;

  const lastIndex = visible.length - 1;

  return (
    <nav
      aria-label="現在の階層"
      style={{
        minWidth: 0,
        fontSize: 'var(--dc-fs-body)',
        color: t.color.text.subtle,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        ...style,
      }}
    >
      {visible.map((item, i) => {
        const isCurrent = i === lastIndex;
        const handler = isCurrent ? undefined : item.onClick ?? (item.to ? () => navigate(item.to as string) : undefined);
        return (
          <Fragment key={`${item.label}-${i}`}>
            {i > 0 && (
              <span aria-hidden style={{ margin: '0 7px', color: t.color.text.subtle }}>
                ›
              </span>
            )}
            {handler ? (
              <button
                type="button"
                onClick={handler}
                className="appearance-none focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: 'inherit',
                  fontFamily: 'inherit',
                  color: t.color.text.subtle,
                  cursor: 'pointer',
                }}
              >
                {item.label}
              </button>
            ) : (
              <span
                aria-current={isCurrent ? 'page' : undefined}
                style={{ color: isCurrent ? t.color.text.body : t.color.text.subtle, fontWeight: isCurrent ? 700 : undefined }}
              >
                {item.label}
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}

export default LearningBreadcrumb;
