import { useEffect, useState } from 'react';

/**
 * CSS のメディアクエリを React の値として読む。
 *
 * レイアウトの切り替えは CSS に任せるのが基本だが、マイノートのフォルダ列は
 * 狭い画面で「別のコンポーネント（横並びのピル）」に置き換わる。DOM を2つ描いて
 * CSS で片方を隠すと、ドラッグ＆ドロップの状態やフォーカスが隠れた側に残るので、
 * ここでどちらを描くかを決める。
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
