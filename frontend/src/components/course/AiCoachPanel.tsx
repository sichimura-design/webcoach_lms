import { useEffect } from 'react';
import { Bot } from 'lucide-react';
import { color, font } from '../../theme/webcoachTheme';
import { UseAiChat } from '../../hooks/useAiChat';
import {
  ChatComposer,
  ChatImageLightbox,
  ChatMessageList,
  chatHeaderStyle,
  useChatZoom,
} from '../chat';

/**
 * 教材ページ右サイドバーのAIコーチ。
 *
 * 中身は components/chat の共通部品で、ヘッダーのドロワー（AiChatDrawer）と同じ。
 * 同じ chatStore の同じ会話を映すので、見た目が別物にならないようにしている。
 */
interface AiCoachPanelProps {
  ai: UseAiChat;
  /**
   * このパネルが表示されているか。
   * 🔴 タブは display:none で出し入れするが、display:none にすると Chromium は
   *    ボックスを捨てるので scrollTop が失われる。再表示のたびに最新へ戻す。
   */
  active?: boolean;
  /** 親が高さを決めているか。false なら会話部分に上限を敷いて自分で収まる */
  fill?: boolean;
}

export function AiCoachPanel({ ai, active = true, fill = false }: AiCoachPanelProps) {
  const zoom = useChatZoom();
  const { messagesEndRef } = ai;

  useEffect(() => {
    if (!active) return;
    messagesEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [active, messagesEndRef]);

  return (
    <div
      className="flex flex-col"
      style={{
        background: color.surface,
        minHeight: 0,
        height: fill ? '100%' : undefined,
        overflow: 'hidden',
      }}
    >
      <div style={chatHeaderStyle}>
        <Bot size={16} style={{ color: color.primary }} />
        <strong style={{ ...font.label, fontWeight: 800, color: color.text, fontFamily: font.family }}>
          AIコーチ
        </strong>
      </div>

      <ChatMessageList
        messages={ai.messages}
        loading={ai.loading}
        endRef={ai.messagesEndRef}
        variant="panel"
        onZoom={zoom.open}
        onPickSuggestion={ai.setInput}
        style={fill ? { flex: 1, minHeight: 0 } : { maxHeight: 280 }}
      />

      <ChatComposer
        ai={ai}
        variant="panel"
        placeholder="この教材について質問する..."
        onZoom={zoom.open}
      />

      {zoom.zoom && (
        <ChatImageLightbox src={zoom.zoom.src} alt={zoom.zoom.alt} onClose={zoom.close} />
      )}
    </div>
  );
}

export default AiCoachPanel;
