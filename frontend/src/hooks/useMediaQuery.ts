import { useEffect, useState } from 'react';

/**
 * CSS のメディアクエリを React の値として読む。
 *
 * レイアウトの切り替えは CSS に任せるのが基本。これが要るのは、幅で「別の
 * コンポーネントに置き換わる」場合と、CSS の値そのものを JS 側で知りたい場合
 * （prefers-reduced-motion で紙吹雪を出すかどうかなど）。DOM を2つ描いて CSS で
 * 片方を隠す作りにすると、隠れた側にフォーカスや状態が残る。
 *
 * かつてマイノートのフォルダ列（1024px 未満は横並びのピル）がこれを使っていたが、
 * フォルダは幅に関わらず同じ上部バーになったので、その分岐は無くなった。
 */
export function useMediaQuery(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && 'matchMedia' in window ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState<boolean>(get);

  useEffect(() => {
    if (typeof window === 'undefined' || !('matchMedia' in window)) return;
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export default useMediaQuery;
