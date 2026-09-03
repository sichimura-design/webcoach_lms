import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import { UseAiChat } from '../../hooks/useAiChat';
import { ChatComposer } from './ChatComposer';
import { ChatImageLightbox, useChatZoom } from './ChatImageLightbox';
import { ChatMessageList } from './ChatMessageList';
import { CHAT_FOCUS_RING, CHAT_Z, aiAvatarStyle, iconButtonStyle } from './chatTheme';

/**
 * 右から出てくるAIコーチのチャット。全画面のヘッダー（AppHeader）から開く。
 *
 * 【器として足りていなかったもの】
 * 背景のスクリムが無く、外側をクリックしても閉じなかった。Esc も効かず、
 * role="dialog" も無いので支援技術には「ただの div」に見えていた。
 * 開いたあとの Tab が背後のページへ抜けていくのも直している。
 *
 * 教材ページ（/course/:id）では AppHeader も描画されるので、このドロワーと
 * サイドバーのAIコーチパネルが同じ chatStore の同じ会話を映す。
 * 見た目が別物にならないよう、中身は components/chat の共通部品で作る。
 */
interface AiChatDrawerProps {
  ai: UseAiChat;
  open: boolean;
  onClose: () => void;
}

const TITLE_ID = 'ai-chat-drawer-title';

export function AiChatDrawer({ ai, open, onClose }: AiChatDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const zoom = useChatZoom();

  // Esc で閉じる。
  // 🔴 bubble フェーズで受ける。上に重なる画像の拡大表示が capture で
  //    stopPropagation するので、Esc 1回目はライトボックス、2回目でここが閉じる。
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // フォーカスの受け渡しと、SPでの背面スクロール止め
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    // 入力欄ではなくパネル自体に当てる。textarea を掴むとSPでキーボードが跳ね上がる
    panelRef.current?.focus();

    // 🔴 inline style だけを退避・復元する。body.with-sidebar / body.learning-workspace は
    //    別のコンポーネントが付け外ししているので、クラスには触らない。
    //    PC ではドロワーが本文を覆わないので、止めるのは SP だけ。
    const isNarrow = window.matchMedia('(max-width: 639px)').matches;
    const prevOverflow = document.body.style.overflow;
    if (isNarrow) document.body.style.overflow = 'hidden';

    return () => {
      if (isNarrow) document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  /** Tab が背後のページへ抜けないよう、前後の見えない番兵で折り返す */
  const wrapFocus = (to: 'first' | 'last') => () => {
    const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), textarea:not(:disabled), a[href], input:not(:disabled), [tabindex]:not([tabindex="-1"])'
    );
    if (!focusables || focusables.length === 0) return;
    const target = to === 'first' ? focusables[0] : focusables[focusables.length - 1];
    target.focus();
  };

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className="wc-drawer-scrim fixed inset-0"
        style={{ zIndex: CHAT_Z.scrim, background: 'rgba(28, 18, 20, .3)' }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        tabIndex={-1}
        className="wc-drawer-right fixed right-0 top-0 h-full w-full sm:w-[400px] flex flex-col"
        style={{
          zIndex: CHAT_Z.drawer,
          background: color.surface,
          borderLeft: `1px solid ${color.border}`,
          boxShadow: '-12px 0 34px rgba(190, 60, 70, .1)',
          outline: 'none',
        }}
      >
        <div tabIndex={0} aria-hidden onFocus={wrapFocus('last')} />

        <div
          className="flex items-center"
          style={{
            gap: 9,
            minHeight: 54,
            padding: '0 12px 0 14px',
            borderBottom: `1px solid ${color.border}`,
            flexShrink: 0,
          }}
        >
          <div aria-hidden style={aiAvatarStyle(28)}>
            AI
          </div>
          <h2
            id={TITLE_ID}
            style={{
              margin: 0,
              // 🔴 index.css が h1〜h3 を Zen Maru Gothic に固定しているので、
              //    トークン側の書体を明示的に戻す
              fontFamily: font.family,
              fontSize: 14.5,
              fontWeight: 800,
              color: color.text,
            }}
          >
            AIコーチに相談
          </h2>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={onClose}
            aria-label="AIコーチを閉じる"
            className={`wc-ai-icon-btn ${CHAT_FOCUS_RING}`}
            style={iconButtonStyle(30)}
          >
            <X size={15} />
          </button>
        </div>

        <ChatMessageList
          messages={ai.messages}
          loading={ai.loading}
          endRef={ai.messagesEndRef}
          variant="drawer"
          onZoom={zoom.open}
          onPickSuggestion={ai.setInput}
          style={{ flex: 1, minHeight: 0 }}
        />

        <ChatComposer
          ai={ai}
          variant="drawer"
          placeholder="質問を入力してください..."
          onZoom={zoom.open}
        />

        <div tabIndex={0} aria-hidden onFocus={wrapFocus('first')} />
      </div>

      {zoom.zoom && (
        <ChatImageLightbox src={zoom.zoom.src} alt={zoom.zoom.alt} onClose={zoom.close} />
      )}
    </>
  );
}

export default AiChatDrawer;
