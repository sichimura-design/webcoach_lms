import { AIConversationMessage } from '../types/api';

const MAX_HISTORY_MESSAGES = 10;

interface ChatLikeMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * ローカルのチャットメッセージ配列からAPIに送るconversation_historyを組み立てる。
 * バックエンド(ai_langgraph.py)のmax_length=10に合わせて直近10件に切り詰める。
 */
export function toConversationHistory(messages: ChatLikeMessage[]): AIConversationMessage[] {
  return messages
    .slice(-MAX_HISTORY_MESSAGES)
    .map(({ role, content }) => ({ role, content }));
}
