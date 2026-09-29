import { useState, useRef, useEffect } from 'react';
import { bffClient } from '../services/bffClient';
import { useChatStore } from '../store/chatStore';
import { toConversationHistory } from '../utils/aiChatHistory';
import type { AIGrounding, AILessonContext } from '../types/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  // 添付画像の表示用データURI。このブラウザセッション内のstateにのみ保持し、
  // サーバー側には保存しない（リロード/別セッションでは消える想定）。
  imageDataUrl?: string;
  /** 教材ページで選択した文章について質問した場合の、その選択文章（ユーザー発言にのみ付く） */
  quote?: string;
  /** 教材ページでの回答の根拠区分（アシスタント発言にのみ付く） */
  grounding?: AIGrounding;
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

/** 教材ページから送る文脈。教材ページ以外（ヘッダーのチャット）では渡さない */
export interface AiChatPageContext {
  courseId?: number;
  lessonContext?: AILessonContext;
}

export function useAiChat() {
  const { messages, addMessage, serverKey } = useChatStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // 生成中の1回ぶん。中止したら外し、あとから返ってきた回答は捨てる（B-009。useLessonAi と同じ考え方）
  const runRef = useRef<AbortController | null>(null);

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

  const sendMessage = async (overrideMessage?: string, pageContext?: AiChatPageContext) => {
    if ((!overrideMessage && !input.trim() && !pendingImage) || loading) return;

    const messageText = overrideMessage ?? (input.trim() || 'この画像について教えてください。');

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      imageDataUrl: pendingImage?.dataUrl,
      quote: pageContext?.lessonContext?.selected_text,
    };

    addMessage(userMessage);
    const currentImage = pendingImage;
    setInput('');
    setPendingImage(null);
    setImageError(null);
    setLoading(true);
    const run = new AbortController();
    runRef.current = run;

    try {
      const result = await bffClient.sendAIMessage({
        message: messageText,
        conversation_history: toConversationHistory(messages),
        session_id: serverKey,
        ...(pageContext?.courseId ? { course_id: pageContext.courseId } : {}),
        ...(pageContext?.lessonContext ? { lesson_context: pageContext.lessonContext } : {}),
        ...(currentImage
          ? {
              image: {
                media_type: currentImage.mediaType,
                data: currentImage.dataUrl.split(',')[1] || '',
              },
            }
          : {}),
      }, undefined, run.signal);
      if (runRef.current !== run) return;

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.message || '回答を取得できませんでした',
        timestamp: new Date(),
        grounding: result.grounding ?? undefined,
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
      if (runRef.current !== run) return;
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '申し訳ございません。一時的なエラーが発生しました。しばらく時間をおいてから、もう一度お試しください。',
        timestamp: new Date(),
      });
    } finally {
      // 中止したあとに次を送っていたら、そちらの「送信中」は消さない
      if (runRef.current === run) {
        runRef.current = null;
        setLoading(false);
      }
    }
  };

  /** 回答の生成を中止する。結果を捨てるだけで、サーバー側の生成は続く */
  const stop = () => {
    const run = runRef.current;
    if (!run) return;
    run.abort();
    runRef.current = null;
    setLoading(false);
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
    stop,
    handleKeyPress,
    pendingImage,
    imageError,
    handleImageSelect,
    clearPendingImage,
  };
}
