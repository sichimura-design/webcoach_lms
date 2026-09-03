import { CSSProperties, RefObject } from 'react';
import { color, font } from '../../theme/webcoachTheme';
import { ChatMessage } from '../../hooks/useAiChat';
import { ChatMarkdown, ChatPlainText } from './ChatMarkdown';
import { ChatThinkingBubble } from './ChatThinkingBubble';
import {
  CHAT_FOCUS_RING,
  ChatVariant,
  aiAvatarStyle,
  bubbleStyle,
  chatListStyle,
} from './chatTheme';

/**
 * 会話の一覧。
 *
 * 会話が1件も無いときだけ、案内文と質問のサジェストを出す。
 * 以前は chatStore に定型のあいさつ1通を仕込んでいたが、それだと
 *   ・「消せない1通目」として履歴に残り続ける
 *   ・最初に何を聞けばいいのかの手がかりにはならない
 * ので、案内は表示側に置いてサジェストを添えた。
 */
interface ChatMessageListProps {
  messages: ChatMessage[];
  loading: boolean;
  endRef: RefObject<HTMLDivElement>;
  variant: ChatVariant;
  /** 添付画像を拡大表示する */
  onZoom: (src: string, alt?: string) => void;
  /** サジェストを押したときに入力欄へ入れる */
  onPickSuggestion?: (text: string) => void;
  style?: CSSProperties;
}

const SUGGESTIONS = [
  'いまの教材の要点を3つ教えて',
  'ここがわからないので、例を出して説明して',
  '次に何を学べばいい？',
];

export function ChatMessageList({
  messages,
  loading,
  endRef,
  variant,
  onZoom,
  onPickSuggestion,
  style,
}: ChatMessageListProps) {
  const empty = messages.length === 0;
  const imageMaxHeight = variant === 'drawer' ? 180 : 140;

  return (
    <div style={{ ...chatListStyle, ...style }}>
      {empty && (
        <div className="wc-ai-msg flex" style={{ gap: 8 }}>
          <div aria-hidden style={aiAvatarStyle()}>
            AI
          </div>
          <div style={bubbleStyle('assistant', variant)}>
            <p style={{ margin: 0, fontWeight: 700, color: color.text }}>
              学習のことなら何でも相談できます
            </p>
            <p style={{ margin: '6px 0 0', color: color.textMuted }}>
              教材の内容、つまずいているところ、次に学ぶことなど。
              画面のスクリーンショットを貼り付けて聞くこともできます。
            </p>
          </div>
        </div>
      )}

      {empty && onPickSuggestion && (
        <div
          className="flex"
          style={{ gap: 6, flexWrap: 'wrap', paddingLeft: 35 }}
        >
          {SUGGESTIONS.map(text => (
            <button
              key={text}
              type="button"
              onClick={() => onPickSuggestion(text)}
              className={`wc-ai-chip ${CHAT_FOCUS_RING}`}
              style={{
                height: 26,
                padding: '0 10px',
                border: `1px solid ${color.borderSoft}`,
                borderRadius: 999,
                background: color.surface,
                color: color.textSecondary,
                fontSize: 10.5,
                fontWeight: 700,
                fontFamily: font.family,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {text}
            </button>
          ))}
        </div>
      )}

      {messages.map(message => {
        const isUser = message.role === 'user';
        return (
          <div
            key={message.id}
            className="wc-ai-msg flex"
            style={{ gap: 8, flexDirection: isUser ? 'row-reverse' : 'row' }}
          >
            {!isUser && (
              <div aria-hidden style={aiAvatarStyle()}>
                AI
              </div>
            )}

            <div
              className="flex flex-col"
              style={{ gap: 4, minWidth: 0, alignItems: isUser ? 'flex-end' : 'flex-start' }}
            >
              <div style={bubbleStyle(message.role, variant)}>
                {message.imageDataUrl && (
                  <button
                    type="button"
                    onClick={() => onZoom(message.imageDataUrl!, message.imageAlt)}
                    aria-label={`${message.imageAlt || '添付画像'} を拡大表示する`}
                    className={CHAT_FOCUS_RING}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: 0,
                      marginBottom: 7,
                      border: `1px solid ${color.border}`,
                      borderRadius: 8,
                      background: color.surface,
                      cursor: 'zoom-in',
                      overflow: 'hidden',
                    }}
                  >
                    <img
                      src={message.imageDataUrl}
                      alt={message.imageAlt || '添付画像'}
                      style={{
                        display: 'block',
                        width: '100%',
                        maxHeight: imageMaxHeight,
                        objectFit: 'cover',
                      }}
                    />
                  </button>
                )}

                {isUser ? (
                  <ChatPlainText content={message.content} />
                ) : (
                  <ChatMarkdown content={message.content} variant={variant} />
                )}
              </div>

              {/* 参照元。回答の根拠がどの教材だったのかを出す */}
              {message.sources && message.sources.length > 0 && (
                <div style={{ maxWidth: '88%' }}>
                  <p
                    style={{
                      margin: '0 0 4px',
                      fontSize: 10,
                      fontWeight: 700,
                      color: color.textFaint,
                      fontFamily: font.family,
                    }}
                  >
                    参照元
                  </p>
                  <div className="flex flex-col" style={{ gap: 4 }}>
                    {message.sources.map((source, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 7,
                          background: color.hoverBg,
                          border: `1px solid ${color.border}`,
                          fontFamily: font.family,
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: color.textStrong,
                          }}
                        >
                          {source.module_name}
                          {source.filename && ` - ${source.filename}`}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 10, color: color.textFaint }}>
                          {source.section_name} | 類似度 {(source.similarity * 100).toFixed(1)}%
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <span style={{ fontSize: 9.5, color: color.textFaint, fontFamily: font.family }}>
                {message.timestamp.toLocaleTimeString('ja-JP', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        );
      })}

      {loading && <ChatThinkingBubble variant={variant} />}

      <div ref={endRef} />
    </div>
  );
}

export default ChatMessageList;
