import { useRef, useState } from 'react';
import { ImagePlus, Send } from 'lucide-react';
import { UseAiChat } from '../../hooks/useAiChat';
import { useAutoGrowTextarea } from '../../hooks/useAutoGrowTextarea';
import { ALLOWED_CHAT_IMAGE_TYPES } from '../../utils/chatImage';
import { color, font } from '../../theme/webcoachTheme';
import { ChatAttachmentChip } from './ChatAttachmentChip';
import { ChatErrorNotice } from './ChatErrorNotice';
import {
  CHAT_FOCUS_RING,
  ChatVariant,
  chatTextareaStyle,
  composerShellStyle,
  iconButtonStyle,
  sendButtonStyle,
} from './chatTheme';

/**
 * 質問の入力欄。ドロワーと教材ページのパネルで共有する。
 *
 * 添付の入り口を3つ揃えている（ボタン / 貼り付け / ドラッグ＆ドロップ）。
 * 以前はボタンが両方、貼り付けは教材ページのパネルだけ、ドロップはどちらにも
 * 無い状態だった。
 */
interface ChatComposerProps {
  ai: UseAiChat;
  variant: ChatVariant;
  placeholder?: string;
  /** 添付画像を拡大表示する（一覧側が持つライトボックスに渡す） */
  onZoom: (src: string, alt?: string) => void;
}

export function ChatComposer({ ai, variant, placeholder, onZoom }: ChatComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useAutoGrowTextarea(ai.input, [variant]);
  const [dropActive, setDropActive] = useState(false);
  // dragenter/dragleave は子要素をまたぐたびに飛ぶので、深さを数えないと点滅する
  const dragDepthRef = useRef(0);

  const hasFiles = (dt: DataTransfer | null) =>
    !!dt && Array.prototype.indexOf.call(dt.types, 'Files') >= 0;

  const accept = ALLOWED_CHAT_IMAGE_TYPES.join(',');
  const hint =
    variant === 'drawer'
      ? 'Enterで送信 / Shift+Enterで改行 / 画像は貼り付け・ドラッグ＆ドロップにも対応'
      : 'Enterで送信 / 画像は貼り付けでも添付できます';

  return (
    <div
      style={{
        padding: variant === 'drawer' ? '10px 14px 12px' : '9px 12px 11px',
        background: color.surface,
        borderTop: `1px solid ${color.border}`,
        flexShrink: 0,
      }}
    >
      <ChatAttachmentChip
        image={ai.pendingImage}
        preparing={ai.imagePreparing}
        onRemove={ai.clearPendingImage}
        onZoom={onZoom}
      />
      <ChatErrorNotice message={ai.imageError} onDismiss={ai.dismissImageError} />

      <div
        style={{ ...composerShellStyle(dropActive), position: 'relative' }}
        onDragEnter={e => {
          if (!hasFiles(e.dataTransfer)) return;
          dragDepthRef.current += 1;
          setDropActive(true);
        }}
        onDragOver={e => {
          // preventDefault しないとブラウザがファイルを開いて画面から離れてしまう
          if (hasFiles(e.dataTransfer)) e.preventDefault();
        }}
        onDragLeave={() => {
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) setDropActive(false);
        }}
        onDrop={e => {
          if (!hasFiles(e.dataTransfer)) return;
          e.preventDefault();
          dragDepthRef.current = 0;
          setDropActive(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void ai.handleImageSelect(file);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) void ai.handleImageSelect(file);
            // 同じファイルをもう一度選べるように毎回空にする
            e.target.value = '';
          }}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={ai.loading}
          aria-label="画像を添付"
          title="画像を添付"
          className={`wc-ai-icon-btn ${CHAT_FOCUS_RING}`}
          style={{ ...iconButtonStyle(28), opacity: ai.loading ? 0.5 : 1, marginBottom: 1 }}
        >
          <ImagePlus size={14} />
        </button>

        <textarea
          ref={textareaRef}
          value={ai.input}
          onChange={e => ai.setInput(e.target.value)}
          onKeyDown={ai.handleKeyDown}
          onPaste={e => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
              if (items[i].type.indexOf('image/') === 0) {
                const file = items[i].getAsFile();
                if (file) {
                  e.preventDefault();
                  void ai.handleImageSelect(file);
                }
                break;
              }
            }
          }}
          placeholder={placeholder ?? '質問を入力...'}
          disabled={ai.loading}
          rows={1}
          style={chatTextareaStyle(variant)}
        />

        <button
          type="button"
          onClick={() => void ai.sendMessage()}
          disabled={!ai.canSend}
          aria-label="送信"
          className={`wc-ai-send ${CHAT_FOCUS_RING}`}
          style={{ ...sendButtonStyle(ai.canSend, 30), marginBottom: 1 }}
        >
          <Send size={14} />
        </button>

        {dropActive && (
          <div
            aria-hidden
            className="absolute inset-0 grid place-items-center"
            style={{
              borderRadius: 12,
              background: 'rgba(255, 246, 247, .92)',
              fontSize: 11.5,
              fontWeight: 700,
              color: color.primary,
              fontFamily: font.family,
              pointerEvents: 'none',
            }}
          >
            ここにドロップして添付
          </div>
        )}
      </div>

      <p
        style={{
          margin: '6px 2px 0',
          fontSize: 10,
          lineHeight: 1.6,
          color: color.textFaint,
          fontFamily: font.family,
        }}
      >
        {hint}
      </p>
    </div>
  );
}

export default ChatComposer;
