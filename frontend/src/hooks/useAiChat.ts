import { useState, useRef, useEffect } from 'react';
import { bffClient } from '../services/bffClient';
import { useChatStore } from '../store/chatStore';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  // 添付画像の表示用データURI。このブラウザセッション内のstateにのみ保持し、
  // サーバー側には保存しない（リロード/別セッションでは消える想定）。
  imageDataUrl?: string;
  sources?: Array<{
    chunk_index: number;
    module_name: string;
    filename: string;
    section_name: string;
    similarity: number;
  }>;
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface PendingImage {
  dataUrl: string;
  mediaType: string;
}

export function useAiChat() {
  const { messages, addMessage } = useChatStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);

  const handleImageSelect = (file: File) => {
    setImageError(null);

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageError('対応していない画像形式です（JPEG/PNG/WebP/GIFのみ）');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setImageError('画像サイズが大きすぎます（上限5MB）');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPendingImage({ dataUrl: reader.result as string, mediaType: file.type });
    };
    reader.onerror = () => {
      setImageError('画像の読み込みに失敗しました');
    };
    reader.readAsDataURL(file);
  };

  const clearPendingImage = () => {
    setPendingImage(null);
    setImageError(null);
  };

  const sendMessage = async () => {
    if ((!input.trim() && !pendingImage) || loading) return;

    const messageText = input.trim() || 'この画像について教えてください。';

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      imageDataUrl: pendingImage?.dataUrl,
    };

    addMessage(userMessage);
    const currentImage = pendingImage;
    setInput('');
    setPendingImage(null);
    setImageError(null);
    setLoading(true);

    try {
      const result = await bffClient.sendAIMessage({
        message: messageText,
        ...(currentImage
          ? {
              image: {
                media_type: currentImage.mediaType,
                data: currentImage.dataUrl.split(',')[1] || '',
              },
            }
          : {}),
      });

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

  return {
    messages,
    input,
    setInput,
    loading,
    messagesEndRef,
    sendMessage,
    handleKeyPress,
    pendingImage,
    imageError,
    handleImageSelect,
    clearPendingImage,
  };
}
