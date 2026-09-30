import { useEffect, useState } from 'react';

/**
 * 表示されてからの経過秒を1秒ごとに返す。待機表示（生成中だけ出る部品）の中で使う。
 * 出ているあいだ＝待っているあいだなので、開始時刻を外から渡さなくてよい。
 */
export function useSecondsSinceMount(): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return seconds;
}

export default useSecondsSinceMount;
