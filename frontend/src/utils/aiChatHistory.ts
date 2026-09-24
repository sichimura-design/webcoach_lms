import { AIConversationMessage } from '../types/api';

const MAX_HISTORY_MESSAGES = 10;

interface ChatLikeMessage {
  role: 'user' | 'assistant';
  content: string;
  /** 教材ページで選択した文章について質問した場合の選択文章 */
  quote?: string;
}

/**
 * ローカルのチャットメッセージ配列からAPIに送るconversation_historyを組み立てる。
 * バックエンド(ai_langgraph.py)のmax_length=10に合わせて直近10件に切り詰める。
 * 選択文章についての質問は、続けて「もう少し詳しく」等と聞かれても対象が分かるよう、
 * 選択文章を発言の前に添える。
 */
export function toConversationHistory(messages: ChatLikeMessage[]): AIConversationMessage[] {
  return messages
    .slice(-MAX_HISTORY_MESSAGES)
    .map(({ role, content, quote }) => ({
      role,
      content: quote ? `（教材の選択箇所:「${quote}」）\n${content}` : content,
    }));
}
