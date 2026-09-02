import { useCallback, useEffect, useState } from 'react';
import { bffClient } from '../services/bffClient';
import { StudyActivity, StudyActivityQuery } from '../types/studyActivity';
import { useStudyTimerStore } from '../store/studyTimerStore';

const PAGE_LIMIT = 30;

/**
 * 学習履歴（新しい順・追記ページング）。/study-log の一覧が使う。
 * 集中ブースの「最近の学習記録」は useStudyStats の recent で足りるのでこちらは不要。
 *
 * 🔴 記録の書き換え（編集・削除・手動追加）はここに置かない。useStudyActivityEditor が持つ。
 *    編集は履歴一覧とカレンダーの日別パネルの両方から起きるが、このフックは
 *    ページング状態を抱えた一覧専用なので、日別パネルからこれを生やしたくない。
 *    editor 側が bumpActivityRevision するので、書き換えの結果はここにも自動で反映される。
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

  return { items, total, hasMore, loading, loadingMore, error, loadMore, reload };
}

export default useStudyActivities;
