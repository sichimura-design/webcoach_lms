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
  /**
   * 画面が出した定型文。AI の発言ではないので吹き出しにせず、会話履歴にも入れない（A-4）。
   *   notice … 「回答の生成を中止しました。」
   *   error  … 通信エラー。「もう一度送る」を付ける（A-5）
   */
  kind?: 'notice' | 'error';
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
  const { messages, addMessage, removeMessage, serverKey } = useChatStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // 生成中の1回ぶん。中止したら外し、あとから返ってきた回答は捨てる（B-009。useLessonAi と同じ考え方）
  const runRef = useRef<AbortController | null>(null);
  // 直前に送った内容。エラーのあと「もう一度送る」で、教材の文脈や画像ごと送り直すために持つ
  const lastRequestRef = useRef<{ text: string; pageContext?: AiChatPageContext; image: PendingImage | null } | null>(null);

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
    lastRequestRef.current = { text: messageText, pageContext, image: currentImage };
    // messages はこの発言を積む前のもの（＝この質問より前の履歴）
    await request(messageText, pageContext, currentImage, toConversationHistory(messages));
  };

  /** 送信の本体。発言を積むのは呼び出し側（送り直しでは同じ質問を積み直さない） */
  const request = async (
    messageText: string,
    pageContext: AiChatPageContext | undefined,
    currentImage: PendingImage | null,
    history: ReturnType<typeof toConversationHistory>,
  ) => {
    setLoading(true);
    const run = new AbortController();
    runRef.current = run;

    try {
      const result = await bffClient.sendAIMessage({
        message: messageText,
        conversation_history: history,
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
        kind: 'error',
        content: '回答を取得できませんでした。通信が不安定か、一時的なエラーです。',
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

  /**
   * 直前がエラーのとき、エラーを消して同じ質問をもう一度送る（A-5）。
   * 教材の文脈・添付画像はこの画面で送ったときのものを使う。
   * もう片方の画面（上部のチャット⇔レッスン画面）で送った質問なら、本文だけで送り直す。
   */
  const retry = async () => {
    if (loading) return;
    const last = messages[messages.length - 1];
    if (last?.kind !== 'error') return;
    let userIdx = messages.length - 2;
    while (userIdx >= 0 && messages[userIdx].role !== 'user') userIdx -= 1;
    if (userIdx < 0) return;
    const question = messages[userIdx];
    const saved = lastRequestRef.current?.text === question.content ? lastRequestRef.current : null;
    removeMessage(last.id);
    await request(
      question.content,
      saved?.pageContext,
      saved?.image ?? null,
      toConversationHistory(messages.slice(0, userIdx)),
    );
  };

  /** 回答の生成を中止する。サーバー側の生成も止まる（bffClient.sendAIMessage） */
  const stop = () => {
    const run = runRef.current;
    if (!run) return;
    run.abort();
    runRef.current = null;
    setLoading(false);
    // 質問は残し、止めたことを会話に残す（Claude/Gemini と同じく、そのまま次の質問を続けられる）
    addMessage({
      id: Date.now().toString(),
      role: 'assistant',
      kind: 'notice',
      content: '回答の生成を中止しました。',
      timestamp: new Date(),
    });
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
    retry,
    handleKeyPress,
    pendingImage,
    imageError,
    handleImageSelect,
    clearPendingImage,
  };
}
