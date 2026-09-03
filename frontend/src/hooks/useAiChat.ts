import { useState, useRef, useEffect } from 'react';
import { bffClient } from '../services/bffClient';
import { useChatStore } from '../store/chatStore';
import {
  ChatImageAttachment,
  chatImageErrorMessage,
  prepareChatImage,
} from '../utils/chatImage';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  // 添付画像の表示用データURI。このブラウザセッション内のstateにのみ保持し、
  // サーバー側には保存しない（リロード/別セッションでは消える想定）。
  imageDataUrl?: string;
  /** 添付画像の代替テキスト。拡大表示のラベルにも使う */
  imageAlt?: string;
  sources?: Array<{
    chunk_index: number;
    module_name: string;
    filename: string;
    section_name: string;
    similarity: number;
  }>;
}

/**
 * 添付待ちの画像。
 * 形式・サイズの検証と縮小は utils/chatImage.ts が持つ。
 */
export type PendingImage = ChatImageAttachment;

/** パネル・ドロワーに渡すためのフックの戻り値型 */
export type UseAiChat = ReturnType<typeof useAiChat>;

export function useAiChat() {
  const { messages, addMessage } = useChatStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [imagePreparing, setImagePreparing] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // 続けて貼り付けたときに、遅れて終わった前の処理で上書きされないようにする
  const selectSeqRef = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // loading も見る。返答待ちの表示が出たときにそこまでスクロールさせる
  }, [messages, loading]);

  const handleImageSelect = async (file: File) => {
    const seq = ++selectSeqRef.current;
    setImageError(null);
    setImagePreparing(true);

    const result = await prepareChatImage(file);

    if (seq !== selectSeqRef.current) return; // もっと新しい選択がある
    setImagePreparing(false);

    if (result.ok) {
      setPendingImage(result.image);
    } else {
      setImageError(chatImageErrorMessage(result.code));
    }
  };

  const clearPendingImage = () => {
    selectSeqRef.current++; // 処理中のものが後から入ってこないように
    setPendingImage(null);
    setImagePreparing(false);
    setImageError(null);
  };

  const dismissImageError = () => setImageError(null);

  /** 送信できる状態か。2つの入り口で同じ判定を使う */
  const canSend = (input.trim().length > 0 || !!pendingImage) && !loading && !imagePreparing;

  const sendMessage = async () => {
    if (!canSend) return;

    const messageText = input.trim() || 'この画像について教えてください。';

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
      imageDataUrl: pendingImage?.dataUrl,
      imageAlt: pendingImage?.fileName,
    };

    addMessage(userMessage);
    const currentImage = pendingImage;
    setInput('');
    clearPendingImage();
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

  /**
   * 入力欄の Enter を送信に割り当てる。onKeyDown に渡すこと。
   *
   * 🔴 IME で変換中の Enter は「変換の確定」であって送信ではない。
   *    ここを見ていないと「がぞう」と打って確定した瞬間に書きかけのまま飛ぶ。
   *    isComposing を持たない環境（古い Safari / 一部の Android IME）は
   *    keyCode 229 で来るので両方見る。
   *    onKeyPress では composing 中のイベントが取れないので onKeyDown を使う。
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    // Ctrl/⌘+Enter は「確実に送る」手段として残す（変換中の判定より後に置く）
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      void sendMessage();
      return;
    }
    if (e.shiftKey || e.altKey) return; // 改行
    e.preventDefault();
    void sendMessage();
  };

  return {
    messages,
    input,
    setInput,
    loading,
    messagesEndRef,
    sendMessage,
    handleKeyDown,
    canSend,
    pendingImage,
    imagePreparing,
    imageError,
    handleImageSelect,
    clearPendingImage,
    dismissImageError,
  };
}
