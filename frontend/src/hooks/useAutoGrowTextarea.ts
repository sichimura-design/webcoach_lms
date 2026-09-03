import { RefObject, useLayoutEffect, useRef } from 'react';

/**
 * 入力量に応じて高さが伸びる textarea。
 *
 * resize: 'none' と併せて使う。ブラウザが右下に描くリサイズハンドル（斜め2本線）が
 * 送信ボタンの脇に見えるのを消す代わりに、書いた分だけ勝手に伸びるようにする。
 *
 * 使い方は「値を渡す」だけ:
 *   const ref = useAutoGrowTextarea(value);
 *   <textarea ref={ref} value={value} style={{ minHeight: 36, maxHeight: 120, resize: 'none' }} />
 *
 * 🔴 onChange ではなく値に対する effect で測る。クイックプロンプトの挿入のように
 *    キー入力を経ずに外から値が変わる経路があり、onChange 起点だと高さが追従しない。
 *
 * 🔴 高さの上限・下限はこのフックでは持たない。呼び出し側が style の
 *    minHeight / maxHeight で決める（CSS が height をクランプしてくれる）。
 *
 * 🔴 display:none の要素では scrollHeight が 0 になるので、隠れている入力欄には
 *    使えない（行数から高さを決める方式にする）。
 *
 * @param value textarea の現在値。これが変わるたびに測り直す
 * @param deps  値以外に高さが変わる条件（レイアウト切り替えで font-size が変わる場合など）
 */
export function useAutoGrowTextarea(
  value: string,
  deps: readonly unknown[] = []
): RefObject<HTMLTextAreaElement> {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // いったん auto に戻さないと、縮んだときに前回の高さが残る
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ...deps]);

  return ref;
}

export default useAutoGrowTextarea;
