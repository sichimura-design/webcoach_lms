import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import { CHAT_FOCUS_RING, CHAT_Z, iconButtonStyle } from './chatTheme';
import { useDismissable } from '../../hooks/useDismissable';

/**
 * 添付画像の拡大表示。
 *
 * 吹き出しの中では高さを抑えて出しているので、スクリーンショットの文字は読めない。
 * クリックで全画面に開く。
 *
 * 🔴 Esc は capture フェーズで受けて伝播を止める（useDismissable の capture=true）。
 *    ドロワーの上に重なって開くので、止めないと Esc 1回で2枚とも閉じる。
 * 🔴 body 直下に portal する。祖先に transform が付いていると position:fixed の
 *    基準がそちらに移ってしまい、画面全体に広がらない。
 */
interface ChatImageLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export function ChatImageLightbox({ src, alt, onClose }: ChatImageLightboxProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const label = alt || '添付画像';

  useDismissable(panelRef, true, onClose, true);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    // inline style だけを退避・復元する。body のクラス（with-sidebar など）は
    // 別のコンポーネントが管理しているので触らない。
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      className="wc-drawer-scrim fixed inset-0 flex flex-col items-center justify-center"
      style={{ zIndex: CHAT_Z.lightbox, background: 'rgba(20, 12, 14, .72)', padding: 24 }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${label} の拡大表示`}
        className="flex flex-col items-center"
        style={{ gap: 12, maxWidth: '100%', maxHeight: '100%' }}
      >
        <img
          src={src}
          alt={label}
          style={{
            maxWidth: 'min(96vw, 1400px)',
            maxHeight: '82vh',
            objectFit: 'contain',
            borderRadius: 10,
            background: color.surface,
          }}
        />
        <div className="flex items-center" style={{ gap: 10 }}>
          <span style={{ ...font.caption, color: 'rgba(255,255,255,.82)', fontFamily: font.family }}>
            背景をクリック、または Esc で閉じます
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="拡大表示を閉じる"
            className={`wc-ai-icon-btn ${CHAT_FOCUS_RING}`}
            style={iconButtonStyle(30)}
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ChatImageLightbox;

/**
 * 拡大表示の開閉。一覧と入力欄の両方から開くので、それらを束ねる側が持つ。
 * ドロワーと教材ページのパネルで同じものを使う。
 */
export function useChatZoom() {
  const [zoom, setZoom] = useState<{ src: string; alt?: string } | null>(null);
  const open = useCallback((src: string, alt?: string) => setZoom({ src, alt }), []);
  const close = useCallback(() => setZoom(null), []);
  return { zoom, open, close };
}
