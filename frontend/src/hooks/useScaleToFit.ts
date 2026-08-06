import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 固定px幅で組んだレイアウト（グリッド列数・flex方向などの構図）を一切変えずに、
 * 使える幅に収まるよう transform:scale で均等に縮小するためのフック。
 * レスポンシブ「折り返し」ではなく、ページ全体をズームアウトするのと同じ見え方にする。
 *
 * outerRef/innerRefはコールバックrefにしている。ローディング中は要素がまだ
 * マウントされていない（≒refがnull）ことがあり、通常のuseEffect(deps固定)では
 * その後に実際にマウントされた瞬間を検知できずResizeObserverが一度も貼られない
 * （＝リロード直後に縮尺が反映されないまま固定される）不具合があったための対策。
 */
export function useScaleToFit(designWidth: number, minScale = 0.45) {
  const outerEl = useRef<HTMLDivElement | null>(null);
  const innerEl = useRef<HTMLDivElement | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const [scale, setScale] = useState(1);
  const [innerHeight, setInnerHeight] = useState(0);

  const recompute = useCallback(() => {
    const outer = outerEl.current;
    const inner = innerEl.current;
    if (!outer || !inner) return;
    // transformは非transformの層のoffsetWidth/Heightに影響しないため、自然な高さをそのまま測れる
    const next = Math.max(minScale, Math.min(1, outer.offsetWidth / designWidth));
    setScale(next);
    setInnerHeight(inner.offsetHeight);
  }, [designWidth, minScale]);

  const ensureObserver = useCallback(() => {
    if (!roRef.current) {
      roRef.current = new ResizeObserver(() => recompute());
    }
    return roRef.current;
  }, [recompute]);

  const outerRef = useCallback((node: HTMLDivElement | null) => {
    if (outerEl.current && roRef.current) roRef.current.unobserve(outerEl.current);
    outerEl.current = node;
    if (node) {
      ensureObserver().observe(node);
      recompute();
    }
  }, [ensureObserver, recompute]);

  const innerRef = useCallback((node: HTMLDivElement | null) => {
    if (innerEl.current && roRef.current) roRef.current.unobserve(innerEl.current);
    innerEl.current = node;
    if (node) {
      ensureObserver().observe(node);
      recompute();
    }
  }, [ensureObserver, recompute]);

  useEffect(() => {
    window.addEventListener('resize', recompute);
    window.addEventListener('load', recompute);
    // フォント読み込み・画像読み込み・サイドバーの開閉状態反映などがrefのアタッチ直後に
    // ずれ込むケースへの保険。ResizeObserverが本来これらを捕捉するはずだが、念のため
    // 次フレーム・少し遅れたタイミングでも取り直す。
    const raf = requestAnimationFrame(recompute);
    const timer = setTimeout(recompute, 300);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('load', recompute);
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      roRef.current?.disconnect();
      roRef.current = null;
    };
  }, [recompute]);

  return { outerRef, innerRef, scale, innerHeight };
}
