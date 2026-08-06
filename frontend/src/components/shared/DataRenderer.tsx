import React from 'react';
import { Loader2 } from 'lucide-react';

interface DataRendererProps<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** data が「空」かどうかを判定する関数。省略時は Array で length === 0 を使用 */
  isEmpty?: (data: T) => boolean;
  empty?: React.ReactNode;
  render: (data: T) => React.ReactNode;
}

/**
 * Render Props パターン。
 * loading / error / empty / success の4状態を処理し、
 * 成功時のみ render prop を呼び出す。
 *
 * @example
 * <DataRenderer
 *   data={apps}
 *   loading={loading}
 *   error={error}
 *   empty={<p>アプリがありません</p>}
 *   render={(apps) => <AppGrid apps={apps} />}
 * />
 */
export function DataRenderer<T>({
  data,
  loading,
  error,
  isEmpty,
  empty,
  render,
}: DataRendererProps<T>): React.ReactElement | null {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-[#FF5A7A] animate-spin" />
        <span
          className="ml-2 text-sm text-[#7A7392]"
        >
          読み込み中...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <p
          className="text-sm text-[#7A7392]"
        >
          {error}
        </p>
      </div>
    );
  }

  const isEmptyValue =
    data === null ||
    (isEmpty ? isEmpty(data) : Array.isArray(data) && (data as unknown[]).length === 0);

  if (isEmptyValue) {
    return empty ? <>{empty}</> : null;
  }

  return <>{render(data as T)}</>;
}
