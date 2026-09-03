import { create } from 'zustand';
import { ChatMessage } from '../hooks/useAiChat';

/**
 * AIコーチの会話。
 *
 * ヘッダーのドロワーと教材ページのサイドバーが同じここを見るので、
 * どちらから聞いても会話は1本に繋がる。
 *
 * 🔴 以前は定型のあいさつ1通を messages の初期値に入れていた。
 *    それだと「消せない1通目」として履歴に残り続け、しかも最初に何を
 *    聞けばいいのかの手がかりにはならなかった。
 *    案内文とサジェストは表示側（ChatMessageList の空の状態）が持つ。
 */
interface ChatState {
  chatOpen: boolean;
  messages: ChatMessage[];
  setChatOpen: (open: boolean) => void;
  addMessage: (message: ChatMessage) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chatOpen: false,
  messages: [],
  setChatOpen: (open) => set({ chatOpen: open }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
}));
