import { color } from '../../theme/webcoachTheme';

/**
 * AIコーチの顔。アプリ全体で「AIが話している」ことを示す唯一の印。
 *
 * 以前はここが赤い角丸に白文字で「AI」と書いただけのチップだった。印としては読めるが、
 * レッスン完了の祝いに添える一言が「誰の言葉なのか」まで伝わらない、という指摘を受けて
 * /public/mascot のきつねに差し替えた。チャットの回答・考え中・完了カードの3か所で
 * 同じ顔を出すので、初めて見る画面でも「さっきのAIコーチだ」と分かる。
 *
 * 🔴 shared/CharacterAvatar.tsx は再利用しない。あれは framer-motion で
 *    repeat: Infinity の揺れを持っていて、チャットの1行1行に置くと本文が読めなくなる。
 *    ここは静止画。跳ねるのは mood="cheer"（完了カード）の登場時の一度だけ。
 * 🔴 画像は透過PNGなので、白いカードの上にそのまま置くと輪郭が消える。
 *    淡いピンクのタイルに乗せてアバターの形を作る。
 */
export type AiCoachMood = 'talk' | 'think' | 'cheer';

/**
 * 🔴 元の fox-*.png（640px・300〜350KB）ではなく 128px 版を使う。
 *    ここは 27〜44px でしか出さないので、原寸だと読み込みが1秒近くかかり、
 *    レッスンを完了した瞬間にアバターが空の丸のまま残る（＝いちばん見せたい瞬間に顔が無い）。
 *    128px 版は同じ絵を canvas で縮めたもの。原寸は CharacterAvatar（大きく出す用）が使う。
 * 🔴 パスは process.env.PUBLIC_URL 起点にする。先頭 `/` の絶対パスに戻すと
 *    dev プレビュー（/branches/<slug>/ 配下）で 404 になり、顔が空の丸になる。
 */
const PUBLIC = process.env.PUBLIC_URL || '';

const SPRITE_BY_MOOD: Record<AiCoachMood, string> = {
  talk: `${PUBLIC}/mascot/fox-talking-128.png`,
  think: `${PUBLIC}/mascot/fox-thinking-128.png`,
  cheer: `${PUBLIC}/mascot/fox-talking-128.png`,
};

interface AiCoachFaceProps {
  /** タイルの一辺（px）。チャットは 27、完了カードは 44 */
  size?: number;
  mood?: AiCoachMood;
}

export function AiCoachFace({ size = 27, mood = 'talk' }: AiCoachFaceProps) {
  return (
    <div
      aria-hidden
      className={mood === 'cheer' ? 'wc-ai-face-pop' : undefined}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        // 小さいうちは角丸、大きく出す完了カードでは丸にする
        borderRadius: size >= 40 ? '50%' : 9,
        background: color.hoverBgTint,
        border: `1px solid ${color.primaryBorderSoft}`,
      }}
    >
      <img
        src={SPRITE_BY_MOOD[mood]}
        alt=""
        style={{ width: '86%', height: '86%', objectFit: 'contain', display: 'block' }}
      />
    </div>
  );
}

export default AiCoachFace;
