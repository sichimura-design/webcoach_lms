import { create } from 'zustand';
import { ChatMessage } from '../hooks/useAiChat';
import { newServerKey } from './aiCoachStore';

// 以前はここに固定の挨拶「こんにちは！WEBCOACH AI学習アシスタントです…」を1件目として積んでいた。
// Dify アプリの挨拶と「こんにちは」が2回並び、保存ボタンも付き、会話履歴として AI にも送られていた。
// 今は会話が空のときの案内として画面側で出す（A-8、AppHeader / CourseContentPage）。

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
  /** 発言を1件取り除く（エラーを「もう一度送る」で置き換えるとき） */
  removeMessage: (id: string) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  chatOpen: false,
  messages: [],
  serverKey: newServerKey(),
  setChatOpen: (open) => set({ chatOpen: open }),
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  removeMessage: (id) => set((state) => ({ messages: state.messages.filter((m) => m.id !== id) })),
}));
