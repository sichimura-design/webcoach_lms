import { create } from 'zustand';
import { ChatMessage } from '../hooks/useAiChat';

const INITIAL_MESSAGE: ChatMessage = {
  id: '1',
  role: 'assistant',
  content: 'こんにちは！WEBCOACH AI学習アシスタントです。学習に関する質問や、コースのおすすめ、キャリアパスについてなど、お気軽にご相談ください。',
  timestamp: new Date(),
};

interface ChatState {
  chatOpen: boolean;
  messages: ChatMessage[];
  setChatOpen: (open: boolean) => void;
  addMessage: (message: ChatMessage) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chatOpen: false,
  messages: [INITIAL_MESSAGE],
  setChatOpen: (open) => set({ chatOpen: open }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
}));
