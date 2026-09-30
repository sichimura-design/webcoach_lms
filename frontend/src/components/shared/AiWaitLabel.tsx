/**
 * 上部のチャット・レッスン画面の AI の「考え中...」。生成中だけ描かれる前提（A-6）。
 * 10秒を過ぎたら経過を、30秒を過ぎたら「時間がかかっています」を出す。
 */
import type { CSSProperties } from 'react';
import { useSecondsSinceMount } from '../../hooks/useSecondsSinceMount';
import { formatWaitElapsed, WAIT_SLOW_FROM_SEC, WAIT_SLOW_MESSAGE } from '../../utils/aiWait';

interface AiWaitLabelProps {
  className?: string;
  style?: CSSProperties;
}

export default function AiWaitLabel({ className, style }: AiWaitLabelProps) {
  const seconds = useSecondsSinceMount();
  const elapsed = formatWaitElapsed(seconds);
  return (
    <span role="status" aria-live="polite" className={className} style={style}>
      {seconds >= WAIT_SLOW_FROM_SEC ? WAIT_SLOW_MESSAGE : '考え中...'}
      {elapsed && <span style={{ marginLeft: 6, opacity: 0.75, fontVariantNumeric: 'tabular-nums' }}>（{elapsed}）</span>}
    </span>
  );
}
