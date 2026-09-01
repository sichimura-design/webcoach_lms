import { MouseEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { font } from '../../theme/webcoachTheme';

/**
 * 教材本文の画像を、アプリ内のオーバーレイで拡大表示する。
 *
 * 🔴 本文は dangerouslySetInnerHTML で描いているので、個々の img に props は付けられない。
 *    そのため「本文全体を包んで click をデリゲーションする」形にしてある。
 *    こうすると figure の図版（block.media）・本文HTML内の img・Moodle フォールバックの
 *    画像が、この1箇所だけで同じ挙動になる。LessonBlockView 側は触らない。
 *
 * 直したかった不具合:
 *   移行教材のHTMLには元サイト（Clipkit）の
 *     <a class="lightbox" href="https://www.dropbox.com/...&raw=1"><img ...></a>
 *   が残っている。対応する JS が無く target="_blank" も無いので、押すと同じタブで
 *   外部の原寸画像へページ遷移し、SPA から離脱していた（＝「画像がでかすぎて戻れない」）。
 *   ここで preventDefault して、代わりに画面へ必ず収まるオーバーレイを出す。
 */

interface ZoomTarget {
  src: string;
  alt: string;
}

interface LessonImageZoomProps {
  children: ReactNode;
}

export function LessonImageZoom({ children }: LessonImageZoomProps) {
  const [target, setTarget] = useState<ZoomTarget | null>(null);
  // 閉じたときに、開く前のフォーカス位置へ戻すために覚えておく
  const lastFocusedRef = useRef<Element | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setTarget(null), []);

  const handleClick = useCallback((e: MouseEvent<HTMLDivElement>) => {
    // 修飾キー付きのクリックは「新しいタブで開く」などの操作。奪わない
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    const node = e.target as HTMLElement | null;
    if (!node) return;

    const anchor = node.closest('a');
    // 普通のリンク（外部教材への導線など）はそのまま働かせる。奪うのは lightbox の残骸だけ
    if (anchor && !anchor.classList.contains('lightbox')) return;

    const img = node.closest('img');
    if (!img || img.hasAttribute('data-no-zoom')) return;

    // ここで初めて外部への遷移を止める
    if (anchor) e.preventDefault();

    /*
     * 表示に使うのはインラインの img の src（移行時に取り込んだローカル資産）。
     * アンカーの href は Dropbox 等の外部ホストで、ホットリンク遮断や404の恐れがあり、
     * プレビュー/オフラインでは開けない。手元にある画像を出すほうが確実。
     */
    const src = img.currentSrc || img.getAttribute('src') || '';
    if (!src) return;

    lastFocusedRef.current = document.activeElement;
    setTarget({ src, alt: img.getAttribute('alt') || '' });
  }, []);

  // Esc で閉じる。
  // 🔴 capture フェーズで購読して stopPropagation する。LearningWorkspacePage が
  //    document のバブル側で Esc を拾ってサポートパネルまで閉じてしまうため、
  //    拡大表示が開いている間はそこへ届かせない。
  useEffect(() => {
    if (!target) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [target, close]);

  // 開いている間は背後の本文をスクロールさせない
  useEffect(() => {
    if (!target) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [target]);

  // 開いたら閉じるボタンへ、閉じたら元の位置へフォーカスを返す
  useEffect(() => {
    if (target) {
      closeButtonRef.current?.focus();
      return;
    }
    const previous = lastFocusedRef.current;
    if (previous instanceof HTMLElement && document.contains(previous)) previous.focus();
  }, [target]);

  return (
    <div onClickCapture={handleClick}>
      {children}
      {target &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={target.alt || '画像の拡大表示'}
            onClick={close}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 120, // 画面内の既存最大は 90（学習インジケータ）。その上に出す
              background: 'rgba(20,10,10,.88)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              padding: 24,
              cursor: 'zoom-out',
              animation: 'wcFadeIn .16s ease-out',
            }}
          >
            <button
              type="button"
              ref={closeButtonRef}
              aria-label="閉じる"
              onClick={close}
              className="grid place-items-center focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 44,
                height: 44,
                borderRadius: 9999,
                border: 'none',
                background: 'rgba(255,255,255,.14)',
                color: '#FFFFFF',
                cursor: 'pointer',
              }}
            >
              <X size={22} />
            </button>

            {/* 🔴 これが「でかすぎ」の対策。原寸がどれだけ大きくても画面を超えない */}
            <img
              src={target.src}
              alt={target.alt}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: 'min(96vw, 1400px)',
                maxHeight: '92vh',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: 8,
                cursor: 'default',
              }}
            />

            {target.alt && (
              <p
                style={{
                  ...font.caption,
                  margin: 0,
                  maxWidth: 'min(96vw, 1400px)',
                  textAlign: 'center',
                  color: 'rgba(255,255,255,.82)',
                }}
              >
                {target.alt}
              </p>
            )}

            <p style={{ ...font.caption, margin: 0, color: 'rgba(255,255,255,.55)' }}>
              背景をクリック、または Esc で閉じます
            </p>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default LessonImageZoom;
