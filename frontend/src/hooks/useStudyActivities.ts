import { useCallback, useEffect, useState } from 'react';
import { bffClient } from '../services/bffClient';
import { StudyActivity, StudyActivityQuery } from '../types/studyActivity';
import { useStudyTimerStore } from '../store/studyTimerStore';

const PAGE_LIMIT = 30;

/**
 * 学習履歴（新しい順・追記ページング）。/study-log の一覧が使う。
 * 集中ブースの「最近の学習記録」は useStudyStats の recent で足りるのでこちらは不要。
 */
export interface UseStudyActivitiesResult {
  items: StudyActivity[];
  total: number;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  loadMore: () => void;
  reload: () => void;
  remove: (activityId: string) => Promise<void>;
}

export function useStudyActivities(
  userId: number | undefined,
  query: StudyActivityQuery = {}
): UseStudyActivitiesResult {
  const [items, setItems] = useState<StudyActivity[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);
  const activityRevision = useStudyTimerStore((s) => s.activityRevision);

  // 一覧クエリはオブジェクトなので、値が同じでも毎回参照が変わる。
  // 依存配列に直接入れると無限ループになるため、文字列化して比較する。
  const queryKey = JSON.stringify(query ?? {});

  const reload = useCallback(() => setTrigger((t) => t + 1), []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);

    bffClient
      .getStudyActivities(userId, { ...JSON.parse(queryKey), limit: PAGE_LIMIT, offset: 0 })
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setTotal(page.total);
        setHasMore(page.hasMore);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('学習履歴を取得できませんでした');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, queryKey, trigger, activityRevision]);

  const loadMore = useCallback(() => {
    if (!userId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    bffClient
      .getStudyActivities(userId, {
        ...JSON.parse(queryKey),
        limit: PAGE_LIMIT,
        offset: items.length,
      })
      .then((page) => {
        setItems((prev) => [...prev, ...page.items]);
        setHasMore(page.hasMore);
        setLoadingMore(false);
      })
      .catch(() => setLoadingMore(false));
  }, [userId, loadingMore, hasMore, queryKey, items.length]);

  const remove = useCallback(
    async (activityId: string) => {
      if (!userId) return;
      try {
        await bffClient.deleteStudyActivity(userId, activityId);
        setItems((prev) => prev.filter((a) => a.id !== activityId));
        setTotal((prev) => Math.max(0, prev - 1));
      } catch {
        /* 失敗しても一覧は変えない */
      }
    },
    [userId]
  );

  return { items, total, hasMore, loading, loadingMore, error, loadMore, reload, remove };
}

export default useStudyActivities;
