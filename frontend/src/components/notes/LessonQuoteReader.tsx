import { MouseEvent, RefObject, useEffect } from 'react';
import { color } from '../../theme/webcoachTheme';
import { LessonDoc } from '../../types/lesson';
import LessonBlockView from '../learning/LessonBlockView';
import { groupByHeading } from '../learning/lessonSections';
import { ClipAnchor, applyClipMarks } from '../learning/clipHighlight';

/**
 * 引用モーダルの中に出す、読み取り専用の教材本文。
 *
 * 🔴 LessonArticle は使わない。あちらは完了ボタン・応援メッセージ・次のレッスン・
 *    カバー画像まで含む「レッスンを進める画面」で、props も 15 個必要になる。
 *    ここで要るのは「文章を選べる本文」だけなので、章立て（LessonArticle.tsx の
 *    sections.map）と LessonBlockView だけを borrowed している。
 * 🔴 LessonImageZoom も挟まない。あれは document.body.style.overflow を直接触るので、
 *    モーダル側のスクロールロックと復元を奪い合う。
 *
 * data-block-id / data-heading を付けるのは LessonBlockView なので、
 * useTextSelection・applyClipMarks・?block= 相当のジャンプはそのまま成立する。
 */
interface LessonQuoteReaderProps {
  doc: LessonDoc;
  /** 選択の判定範囲。この div の外側の選択は useTextSelection が無視する */
  articleRef: RefObject<HTMLDivElement>;
  /** すでにこのノートへ引いてある箇所。<mark> で示す */
  clips: ClipAnchor[];
  /** 出どころ行から開いたときに一瞬光らせる教材ブロック */
  flashBlockId: string | null;
}

export function LessonQuoteReader({ doc, articleRef, clips, flashBlockId }: LessonQuoteReaderProps) {
  // 保存済みクリップを本文へ当て直す。ブロックが差し替わるたびに再適用する。
  useEffect(() => {
    const container = articleRef.current;
    if (!container) return;
    applyClipMarks(container, clips);
  }, [articleRef, clips, doc.lessonId]);

  /**
   * 本文の中のリンクで、このタブを離脱させない。
   *
   * 移行教材のHTMLには元サイトの `<a class="lightbox" href="https://www.dropbox.com/…">`
   * が残っていて、押すと同じタブで原寸画像へ飛ぶ（LessonImageZoom.tsx の冒頭に経緯）。
   * 教材ページではそれを拡大表示に差し替えているが、モーダルで同じことが起きると
   * **書きかけのノートごと** 画面が飛ぶ。ここでは遷移だけを止め、
   * 中身のあるリンクは別タブに逃がす。
   */
  const handleClick = (e: MouseEvent<HTMLElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const anchor = (e.target as HTMLElement | null)?.closest('a');
    if (!anchor) return;
    e.preventDefault();
    const href = anchor.getAttribute('href');
    // lightbox の残骸は「原寸画像へのリンク」でしかないので開かない
    if (!href || href.startsWith('#') || anchor.classList.contains('lightbox')) return;
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  const sections = groupByHeading(doc.blocks);

  return (
    <article
      onClickCapture={handleClick}
      /* 移行教材が持ち込む CSS は .wc-lesson-scope の内側だけに効くよう書き換えてある。
         この枠を付けて初めて元の見た目になる（LessonArticle と同じ扱い）。 */
      className={doc.css ? 'wc-lesson-scope' : undefined}
      style={{
        // 読み幅の CSS 変数 --wc-reading-max は .wc-learning-shell にしか無い。
        // モーダルはその外なので、ここで自前の幅を持つ。
        width: 'min(100%, 760px)',
        margin: '0 auto',
      }}
    >
      {doc.css && <style>{doc.css}</style>}

      <div ref={articleRef} data-lesson-article>
        {sections.map((section) => (
          /* 🔴 このラッパーには data-block-id を付けない。
             選択とクリップ復元がその属性でブロックを引いているので、
             章の箱が混ざると誤検出する。 */
          <section key={`sec-${section.index}`} style={{ marginBottom: 8 }}>
            {section.heading && (
              <div className="flex items-center" style={{ gap: 12, margin: '30px 0 14px' }}>
                <span
                  aria-hidden
                  className="grid place-items-center flex-shrink-0"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: color.primary,
                    color: color.textOnPrimary,
                    fontSize: 12,
                    fontWeight: 900,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {String(section.index).padStart(2, '0')}
                </span>
                <h3
                  style={{
                    margin: 0,
                    fontSize: 20,
                    fontWeight: 900,
                    lineHeight: 1.45,
                    letterSpacing: '-.015em',
                    color: color.text,
                  }}
                >
                  {section.heading}
                </h3>
              </div>
            )}
            {section.blocks.map((block) => (
              <LessonBlockView key={block.id} block={block} flashing={flashBlockId === block.id} />
            ))}
          </section>
        ))}
        {/* まとめ・次にやること・完了ボタンは出さない。data-block-id を持たない文章は
            選んでもクリップできず、「選べない文章が混ざっている」状態になるため。 */}
      </div>
    </article>
  );
}

export default LessonQuoteReader;
