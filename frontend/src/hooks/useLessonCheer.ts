import { useEffect, useRef, useState } from 'react';
import { bffClient } from '../services/bffClient';
import { LessonCheerResponse } from '../types/lesson';

/**
 * レッスンを完了したときのAIコーチのひと言。
 *
 * 文面の判断（節目なのか、ノートを取った回なのか）はすべてサーバ側に持たせている。
 * 進捗の正はコースの目次で、画面側の completedIds は「開いたレッスンだけ」しか
 * 持っていないため（hooks/useLessonCompletion.ts のフェッチ条件を参照）、
 * ここで単元完走やコース進捗を組み立てると必ず間違う。
 *
 * 🔴 取得に失敗したら null のまま黙って返す。
 *    達成カード側が従来の固定文にフォールバックする。祝う面が空欄になるより、
 *    決まり文句が出るほうがましなので、エラー表示もトーストも出さない。
 *    実BFFにこのAPIは無いので、モックOFF（本番）では常にこの経路になる。
 */
export interface UseLessonCheer {
  cheer: LessonCheerResponse | null;
  loading: boolean;
}

export function useLessonCheer(
  courseId: number,
  lessonId: number | null,
  isCompleted: boolean,
  askedCount: number
): UseLessonCheer {
  const [cheer, setCheer] = useState<LessonCheerResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // 🔴 askedCount は依存に入れない。完了したあとに続けて質問すると
  //    ひと言が入れ替わってしまい、「いま言われたこと」が消える。
  //    完了した瞬間の値だけを見る。
  const askedCountRef = useRef(askedCount);
  askedCountRef.current = askedCount;

  useEffect(() => {
    // 未完了なら投げない（完了を取り消した直後の無駄打ちもここで止まる）
    if (!lessonId || !isCompleted) {
      setCheer(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    bffClient
      .getLessonCheer({ courseId, lessonId, askedCount: askedCountRef.current })
      .then((res) => {
        if (alive) setCheer(res?.message ? res : null);
      })
      .catch(() => {
        if (alive) setCheer(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [courseId, lessonId, isCompleted]);

  return { cheer, loading };
}

export default useLessonCheer;
