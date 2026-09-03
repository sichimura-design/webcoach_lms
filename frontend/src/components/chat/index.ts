/**
 * AIチャットの共通部品。
 * ヘッダーのドロワー（AiChatDrawer）と教材ページのAIコーチパネル
 * （components/course/AiCoachPanel）が同じものを使う。
 */

export { AiChatDrawer } from './AiChatDrawer';
export { ChatComposer } from './ChatComposer';
export { ChatMessageList } from './ChatMessageList';
export { ChatThinkingBubble } from './ChatThinkingBubble';
export { ChatImageLightbox, useChatZoom } from './ChatImageLightbox';
export { ChatAttachmentChip } from './ChatAttachmentChip';
export { ChatErrorNotice } from './ChatErrorNotice';
export { ChatMarkdown, ChatPlainText } from './ChatMarkdown';
export * from './chatTheme';
