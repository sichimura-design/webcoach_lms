import { RefObject, useLayoutEffect, useRef } from 'react';

/**
 * 入力量に応じて高さが伸びる textarea。
 *
 * 元は `resize: 'vertical'` に頼っていたが、ブラウザが右下に描くリサイズハンドル
 * （斜め2本線）が送信ボタンの脇に見えてしまうため `resize: 'none'` にした。
 * 自分で広げる手段を奪う代わりに、書いた分だけ勝手に伸びるようにする。
 *
 * 使い方は「値を渡す」だけ:
 *   const ref = useAutoGrowTextarea(value);
 *   <textarea ref={ref} value={value} style={{ minHeight: 56, maxHeight: 200, resize: 'none' }} />
 *
 * 🔴 onChange ではなく値に対する effect で測る。引用の挿入・クイックプロンプト・
 *    下書きの復元のように、キー入力を経ずに外から値が変わる経路があり、
 *    onChange 起点だとそれらで高さが追従しない。
 *
 * 🔴 高さの上限・下限はこのフックでは持たない。呼び出し側が style の
 *    minHeight / maxHeight で決める（CSS が height をクランプしてくれる）。
 *    上限に達したあとは textarea 既定の overflow で中スクロールになる。
 *
 * @param value    textarea の現在値。これが変わるたびに測り直す
 * @param deps     値以外に高さが変わる条件（例: 広い/狭いレイアウトの切り替えで
 *                 minHeight・maxHeight・font-size が変わる場合）
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
