import { NotebookPen, Sparkles } from 'lucide-react';
import { color, shadow } from '../../theme/webcoachTheme';

/**
 * 教材を読みながらAI・メモへ入るための常設ピル（右下）。
 *
 * 以前は目次とサポートがそれぞれ画面の列を持っていて、
 * 「やれることが多すぎて集中が切れる」状態だった。
 * 本文の面積は一切削らず、必要になった瞬間だけオーバーレイを開く入口にする。
 *
 * 選択ツールバー（z-index 80）より下、オーバーレイ（70）より下に置く。
 * テキストを選んでいる間・オーバーレイが開いている間は hidden で引っ込める。
 */
interface LessonFloatingActionsProps {
  hidden?: boolean;
  onOpenAi: () => void;
  onOpenMemo: () => void;
}

const BUTTON_STYLE: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 9,
  height: 46,
  padding: '0 20px',
  border: 0,
  background: 'transparent',
  color: color.textStrong,
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

export function LessonFloatingActions({ hidden, onOpenAi, onOpenMemo }: LessonFloatingActionsProps) {
  return (
    <div
      className="wc-lesson-fab"
      style={{
        position: 'fixed',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        background: color.surface,
        border: `1px solid ${color.border}`,
        borderRadius: 999,
        boxShadow: shadow.hero,
        // 消すのではなく引っ込める。選択を解除したらすぐ戻ってきてほしい
        opacity: hidden ? 0 : 1,
        transform: hidden ? 'translateY(12px)' : 'none',
        pointerEvents: hidden ? 'none' : 'auto',
        transition: 'opacity .18s ease, transform .18s ease',
      }}
    >
      <button
        type="button"
        onClick={onOpenAi}
        className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={BUTTON_STYLE}
      >
        <Sparkles size={16} style={{ color: color.primary }} />
        AIに聞く
      </button>

      <span aria-hidden style={{ width: 1, height: 22, background: color.divider }} />

      <button
        type="button"
        onClick={onOpenMemo}
        className="focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={BUTTON_STYLE}
      >
        <NotebookPen size={16} style={{ color: color.primary }} />
        メモする
      </button>
    </div>
  );
}

export default LessonFloatingActions;
