import { useCallback, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Minimize2 } from 'lucide-react';
import { useAiCoachStore } from '../../store/aiCoachStore';

/**
 * AI専用ページ（/ai-coach）の最上部に常設する戻り帯。
 *
 * 「広い画面で続ける」で来たときだけ出る。狙いは**出口を1箇所に固定する**こと。
 * 以前は「元の画面に戻す」をチャットヘッダーの中に、しかも
 * 「拡大した会話を開いている間だけ」出していたので、
 *   ・ヘッダーの「AIコーチ」を押してホーム状態へ移る
 *   ・履歴から別の相談を開く／新しい相談を始める
 * のどれでも導線が消え、戻り先は store に残っているのに画面から辿れなくなっていた。
 * ホーム状態には戻り導線がそもそも無かったので、そこに落ちると出口がゼロになる。
 *
 * ここはページ側（AiCoachPage）が描くので、中がホームでもチャットでも
 * 同じ位置に在り続ける。会話を消しても消えない（戻り先のパスは有効なまま）。
 *
 * ラベルと挙動は「いま画面に出ている会話が、拡大した会話かどうか」で分ける:
 *   一致する … 「元の画面に戻す」。拡大の対の操作なので、ドロワーから来たなら
 *               ドロワーを開き直す（＝畳んで元の場所に戻す）。
 *   しない   … 「◯◯に戻る」。ただの移動。ここでドロワーを開くと、
 *               画面で見ていた会話と開いたドロワーの会話が食い違う。
 */
interface AiCoachReturnBarProps {
  /** いま開いている会話。ホーム状態では null */
  activeId: string | null;
}

export function AiCoachReturnBar({ activeId }: AiCoachReturnBarProps) {
  const navigate = useNavigate();
  const expandOrigin = useAiCoachStore((s) => s.expandOrigin);
  const clearExpandOrigin = useAiCoachStore((s) => s.clearExpandOrigin);
  const setDrawerOpen = useAiCoachStore((s) => s.setDrawerOpen);

  /** 拡大した会話をいま開いている＝「畳む」が成立する */
  const isCollapse = !!expandOrigin && expandOrigin.sessionId === activeId;

  const handleClick = useCallback(() => {
    if (!expandOrigin) return;
    clearExpandOrigin();
    if (expandOrigin.fromDrawer && isCollapse) setDrawerOpen(true);
    navigate(expandOrigin.path);
  }, [clearExpandOrigin, expandOrigin, isCollapse, navigate, setDrawerOpen]);

  if (!expandOrigin) return null;

  // label は後から足したフィールド。拡大したまま更新を挟んだセッションでも
  // 帯が無言で壊れないように、無ければ一般名で描く。
  const label = isCollapse ? '元の画面に戻す' : expandOrigin.label || '元の画面に戻る';

  return (
    <div style={BAR_STYLE}>
      <button
        type="button"
        onClick={handleClick}
        title={
          isCollapse && expandOrigin.fromDrawer
            ? '広い画面をやめて、元の画面のAIコーチパネルに戻します（会話はそのまま続きます）'
            : '広い画面をやめて、元の画面に戻します（会話はAIコーチに残ります）'
        }
        className="inline-flex items-center hover:bg-[#FDF7F3] focus-visible:ring-2 focus-visible:ring-[#F6B9BD]"
        style={BUTTON_STYLE}
      >
        {isCollapse ? (
          <Minimize2 size={14} style={{ color: 'var(--dc-text-muted)', flexShrink: 0 }} />
        ) : (
          <ChevronLeft size={15} style={{ color: 'var(--dc-text-muted)', flexShrink: 0 }} />
        )}
        {label}
      </button>
    </div>
  );
}

/* 帯は地の色のまま（面を足さない）。下の細い罫だけで本体と切る。
   AIコーチのホームは余白で読ませる画面なので、ここに白いバーを敷くと
   上部だけ別のページのように浮いてしまう。 */
const BAR_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexShrink: 0,
  height: 38,
  padding: '0 12px',
  borderBottom: '1px solid var(--dc-border)',
  background: 'var(--dc-bg)',
};

const BUTTON_STYLE: CSSProperties = {
  gap: 4,
  height: 28,
  padding: '0 10px 0 6px',
  border: 0,
  borderRadius: 'var(--dc-radius-md)',
  background: 'none',
  color: 'var(--dc-text)',
  fontFamily: 'inherit',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export default AiCoachReturnBar;
