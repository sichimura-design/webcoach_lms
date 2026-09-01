import React, { createContext, useContext, useState, useCallback } from 'react';

// ─── 型定義 ──────────────────────────────────

type ToastType = 'success' | 'error' | 'info';

/**
 * トーストに1つだけ添えられる操作。
 * 「保存したものをすぐ見る」のように、画面を移動せずに済ませた操作へ
 * あとから入る入口を出すためのもの（hooks/useNoteCapture.ts）。
 */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  action?: ToastAction;
  /** 自動で消えるまでの時間。既定は action 付きで6秒、無しで3秒 */
  durationMs?: number;
}

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, options?: ToastOptions) => void;
}

// ─── Context ─────────────────────────────────

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

/** 押せるものが入るぶん、読む時間が要る */
const DURATION_WITH_ACTION_MS = 6000;
const DURATION_MS = 3000;

// ─── Provider ────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', options?: ToastOptions) => {
    const id = `${Date.now()}-${Math.random()}`;
    const action = options?.action;
    setToasts(prev => [...prev, { id, message, type, action }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, options?.durationMs ?? (action ? DURATION_WITH_ACTION_MS : DURATION_MS));
  }, []);

  const toastBg: Record<ToastType, string> = {
    error:   '#E86D78',
    success: '#6BBF8A',
    info:    '#4B3A33',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* トーストコンテナ。
          role="status" / aria-live を付けているのは、中に押せるボタンが入るため
          （読み上げ環境で「ノートを見る」の存在に気づけない状態を避ける）。 */}
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-8 right-8 flex flex-col gap-2 z-[9999] pointer-events-none"
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium pointer-events-auto"
            style={{
              fontFamily: 'Noto Sans JP, sans-serif',
              background: toastBg[toast.type],
              color: '#ffffff',
              animation: 'fadeInUp 0.2s ease-out',
            }}
          >
            <span>{toast.message}</span>

            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  const { onClick } = toast.action!;
                  dismiss(toast.id);
                  onClick();
                }}
                className="focus-visible:ring-2 focus-visible:ring-white"
                style={{
                  flexShrink: 0,
                  padding: '4px 12px',
                  border: 0,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,.20)',
                  color: '#ffffff',
                  fontFamily: 'inherit',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {toast.action.label}
              </button>
            )}

            {/* 🔴 手で消せるようにする。トーストは z-9999 で、教材ページの
                右下ピル（LessonFloatingActions）を覆う位置にいる。
                消せないと次の操作が待たされる。
                🔴 action の有無で出し分けない。案内文の長いトーストは
                   durationMs を伸ばすので、action が無いものほど残る。 */}
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="閉じる"
              className="grid place-items-center focus-visible:ring-2 focus-visible:ring-white"
              style={{
                flexShrink: 0,
                width: 22,
                height: 22,
                border: 0,
                borderRadius: 999,
                background: 'transparent',
                color: '#ffffff',
                fontFamily: 'inherit',
                fontSize: 15,
                lineHeight: 1,
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────

export const useToast = () => useContext(ToastContext);
