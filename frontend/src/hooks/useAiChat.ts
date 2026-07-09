import { useState, useRef, useEffect } from 'react';
import { bffClient } from '../services/bffClient';
import { useChatStore } from '../store/chatStore';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  image?: string; // 添付画像（data URL）
  sources?: Array<{
    chunk_index: number;
    module_name: string;
    filename: string;
    section_name: string;
    similarity: number;
  }>;
}

export function useAiChat() {
  const { messages, addMessage } = useChatStore();
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);

  const sendMessage = async () => {
    if ((!input.trim() && !attachedImage) || loading) return;

    const currentImage = attachedImage;
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input || (currentImage ? '（画像を添付しました）' : ''),
      timestamp: new Date(),
      image: currentImage || undefined,
    };

    addMessage(userMessage);
    const currentInput = input;
    setInput('');
    setAttachedImage(null);
    setLoading(true);

    try {
      const result = await bffClient.sendAIMessage({ message: currentInput || '添付した画像について教えてください', image: currentImage || undefined });

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.message || '回答を取得できませんでした',
        timestamp: new Date(),
        sources: (result.sources || []).map((s: any) => ({
          chunk_index: s.chunk_index || 0,
          module_name: s.module_name || '',
          filename: s.filename || '',
          section_name: s.section_name || '',
          similarity: s.similarity || 0,
        })),
      };

      addMessage(assistantMessage);
    } catch (error: any) {
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '申し訳ございません。一時的なエラーが発生しました。しばらく時間をおいてから、もう一度お試しください。',
        timestamp: new Date(),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return { messages, input, setInput, loading, messagesEndRef, sendMessage, handleKeyPress, attachedImage, setAttachedImage };
}
