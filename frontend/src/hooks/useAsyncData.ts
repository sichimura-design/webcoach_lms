import { useState, useEffect, useCallback, DependencyList } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * 非同期データ取得の共通 hook。
 * loading / error / data / refetch を返す。
 *
 * @param fetcher - データを取得する非同期関数（deps が変わるたびに再実行）
 * @param deps    - 再取得をトリガーする依存値の配列
 *
 * @example
 * const { data: apps, loading, error } = useAsyncData(
 *   () => bffClient.getAIApplications(),
 *   []
 * );
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList = [],
): AsyncState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setState(prev => ({ ...prev, loading: true, error: null }));

    fetcher()
      .then(data => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((err: any) => {
        if (!cancelled) {
          const message =
            err.response?.status === 403
              ? 'アクセス権がありません。'
              : err.message || '読み込みに失敗しました';
          setState({ data: null, loading: false, error: message });
        }
      });

    return () => {
      cancelled = true;
    };
    // fetcher は毎レンダーで新しい参照になるため deps と trigger のみで制御する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, trigger]);

  const refetch = useCallback(() => setTrigger(n => n + 1), []);

  return { ...state, refetch };
}
