import React, { createContext, useContext, useState, useCallback } from 'react';

// ─── 型定義 ──────────────────────────────────

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

// ─── Context ─────────────────────────────────

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

// ─── Provider ────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const toastBg: Record<ToastType, string> = {
    error:   '#E86D78',
    success: '#6BBF8A',
    info:    '#4B3A33',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* トーストコンテナ */}
      <div className="fixed bottom-8 right-8 flex flex-col gap-2 z-[9999] pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className="px-5 py-3 rounded-2xl shadow-lg text-sm font-medium pointer-events-auto"
            style={{
              fontFamily: 'Noto Sans JP, sans-serif',
              background: toastBg[toast.type],
              color: '#ffffff',
              animation: 'fadeInUp 0.2s ease-out',
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────

export const useToast = () => useContext(ToastContext);
