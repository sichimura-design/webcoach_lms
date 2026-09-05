/**
 * 1ヶ月ぶんの学習記録の実体。カレンダーの日別詳細パネルが使う。
 * ============================================================
 * 🔴 なぜ useStudyStats の結果から絞らないのか:
 *    stats.dailyTotals は「日付と合計分数」しか持たない。日別パネルは教材名・メモ・
 *    達成度・カテゴリ内訳まで出すので、StudyActivity の実体が要る。
 *    かといって全期間の実体（最大1000件 ≒600KB）を stats に載せるのは論外なので、
 *    見ている月のぶんだけ取る。
 *
 * 🔴 なぜ日単位ではなく月単位で取るのか:
 *    カレンダーは「隣の日はどうだったか」を続けて見る道具なので、日ごとに取ると
 *    クリックのたびに通信が走る。月で1回取ってしまえば同じ月内の日送りは無通信。
 *
 * 月キーで useRef の Map にためる。activityRevision（記録の追加・編集・削除）で
 * Map ごと捨てるので、編集した内容は次に開いたときに必ず新しい値になる。
 * ============================================================
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { bffClient } from '../services/bffClient';
import { StudyActivity } from '../types/studyActivity';
import { useStudyTimerStore } from '../store/studyTimerStore';

/** 1ヶ月ぶんの上限。1日3件×31日でも足りる */
const MONTH_LIMIT = 200;

export interface UseMonthActivitiesResult {
  /** 見ている月の記録（新しい順）。未取得なら空配列 */
  activities: StudyActivity[];
  loading: boolean;
  /** 取得に失敗した。カレンダーは「0分」ではなく「未取得」として描く */
  failed: boolean;
}

/** 'YYYY-MM' → その月の初日と末日のキー */
function monthRange(monthKey: string): { from: string; to: string } {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const lastDay = new Date(year, month, 0).getDate();
  return { from: `${monthKey}-01`, to: `${monthKey}-${String(lastDay).padStart(2, '0')}` };
}

export function useMonthActivities(
  userId: number | undefined,
  monthKey: string | null
): UseMonthActivitiesResult {
  const [activities, setActivities] = useState<StudyActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const cacheRef = useRef<Map<string, StudyActivity[]>>(new Map());
  // 応答が前後しても最後に開いた月の結果だけを採る（useNoteList と同じ作法）
  const reqRef = useRef(0);

  const activityRevision = useStudyTimerStore((s) => s.activityRevision);
  const revisionRef = useRef(activityRevision);
  if (revisionRef.current !== activityRevision) {
    // 記録が変わったらキャッシュは全部古い。次の effect で取り直す
    revisionRef.current = activityRevision;
    cacheRef.current = new Map();
  }

  const load = useCallback(
    async (key: string, uid: number) => {
      const cached = cacheRef.current.get(key);
      if (cached) {
        setActivities(cached);
        setLoading(false);
        setFailed(false);
        return;
      }

      const seq = ++reqRef.current;
      setLoading(true);
      setFailed(false);
      try {
        const { from, to } = monthRange(key);
        const page = await bffClient.getStudyActivities(uid, { from, to, limit: MONTH_LIMIT });
        if (seq !== reqRef.current) return;
        cacheRef.current.set(key, page.items);
        setActivities(page.items);
      } catch {
        if (seq !== reqRef.current) return;
        setActivities([]);
        setFailed(true);
      } finally {
        if (seq === reqRef.current) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!userId || !monthKey) {
      setActivities([]);
      setLoading(false);
      setFailed(false);
      return;
    }
    void load(monthKey, userId);
  }, [userId, monthKey, load, activityRevision]);

  return { activities, loading, failed };
}

export default useMonthActivities;
