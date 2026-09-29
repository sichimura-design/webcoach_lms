import { create } from 'zustand';
import { ChatMessage } from '../hooks/useAiChat';
import { newServerKey } from './aiCoachStore';

const INITIAL_MESSAGE: ChatMessage = {
  id: '1',
  role: 'assistant',
  content: 'こんにちは！WEBCOACH AI学習アシスタントです。学習に関する質問や、コースのおすすめ、キャリアパスについてなど、お気軽にご相談ください。',
  timestamp: new Date(),
};

interface ChatState {
  chatOpen: boolean;
  messages: ChatMessage[];
  /**
   * api-server に session_id として送る鍵（B-007）。送らないと api-server は
   * 「ユーザー＋空の会話ID」で直前のAIアプリを覚えるので、別画面のAI相談と固定が混ざる。
   * このストアは保存しないので、読み込みごとに新しい会話になる。
   */
  serverKey: string;
  setChatOpen: (open: boolean) => void;
  addMessage: (message: ChatMessage) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chatOpen: false,
  messages: [INITIAL_MESSAGE],
  serverKey: newServerKey(),
  setChatOpen: (open) => set({ chatOpen: open }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
}));
