import { useEffect, useState } from 'react';
import { color } from '../../theme/webcoachTheme';
import { ChatVariant, aiAvatarStyle, bubbleStyle } from './chatTheme';

/**
 * AIが考えているあいだの表示。
 *
 * 以前はぐるぐる回るスピナーと「考え中...」の1行だけで、待っている実感も
 * 進んでいる実感もなかった。ループするスピナーは「終わらない処理」に見える。
 *
 * ここでやることは2つ。
 *   1. これから来る回答の形をスケルトンで先に置く。回答が入ったときに高さが
 *      飛ばず、パネルがガタッと動かない。
 *   2. 何をしているかを段階的に言う。1.2秒ごとに1つ進み、最後で止まる。
 *
 * スケルトンの光の流れ（.wc-skel）と点の明滅（.wc-think-dot）は index.css。
 * prefers-reduced-motion では動きが止まるが、灰色の面としては残す
 * （消すと「待っている」ことまで伝わらなくなる）。
 */
interface ChatThinkingBubbleProps {
  variant: ChatVariant;
}

/** 文言が進む間隔。速いと読めず、遅いと止まって見える */
const STEP_MS = 1200;

const STEPS = ['質問を読んでいます', '教材の該当箇所を探しています', '回答をまとめています'];

export function ChatThinkingBubble({ variant }: ChatThinkingBubbleProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    // 最後まで来たら進めない。タイマーも張り直さない。
    if (step >= STEPS.length - 1) return;
    const timer = window.setTimeout(() => setStep(s => s + 1), STEP_MS);
    return () => window.clearTimeout(timer);
  }, [step]);

  // 狭いパネルではスケルトンを1ブロックだけにする
  const skeletonBlocks = variant === 'drawer' ? 2 : 1;

  return (
    <div className="wc-ai-msg flex" style={{ gap: 8 }}>
      <div aria-hidden style={aiAvatarStyle()}>
        AI
      </div>

      <div style={{ ...bubbleStyle('assistant', variant), flex: 1 }}>
        <div className="flex items-center" style={{ gap: 7 }}>
          <span aria-hidden className="wc-think-dots inline-flex" style={{ gap: 3 }}>
            <span className="wc-think-dot" />
            <span className="wc-think-dot" />
            <span className="wc-think-dot" />
          </span>
          <span role="status" aria-live="polite" style={{ fontSize: 11, color: color.textMuted }}>
            {STEPS[step]}
          </span>
        </div>

        {/* 回答の形（見出し＋本文2行＋根拠のブロック）をなぞる */}
        <div aria-hidden style={{ marginTop: 9 }}>
          <div className="wc-skel" style={{ width: 52, height: 9 }} />
          <div className="wc-skel" style={{ width: '100%', height: 8, marginTop: 8 }} />
          <div className="wc-skel" style={{ width: '78%', height: 8, marginTop: 6 }} />

          {Array.from({ length: skeletonBlocks }).map((_, i) => (
            <div
              key={i}
              style={{ marginTop: 9, padding: '9px 10px', borderRadius: 9, background: color.pageBg }}
            >
              <div className="wc-skel" style={{ width: 64, height: 8 }} />
              <div className="wc-skel" style={{ width: '90%', height: 8, marginTop: 7 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ChatThinkingBubble;
