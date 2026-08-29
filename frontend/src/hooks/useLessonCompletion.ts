import { useCallback, useEffect, useState } from 'react';
import { bffClient } from '../services/bffClient';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useProgressionStore } from '../store/progressionStore';
import { EXP_RULES } from '../utils/progression';

/**
 * レッスンの完了状態。
 *
 * 旧 CourseContentPage.tsx の handleToggleComplete をそのまま移設したもの。
 * 完了記録・EXP付与・resumeCourse更新という一連のデータ副作用は
 * マイページやバッジの表示に効いているため、挙動を変えないこと。
 *
 * 🔴 onAdvance（完了したら次のレッスンへ自動で進む）は任意にした。
 *    デザイン案 2a のレッスン終点は、完了したら緑の達成カードを見せて
 *    「次のレッスンへ」を自分で押させる形になっている。自動で飛ばすと
 *    その達成カードが一瞬も見えず、祝う面がまるごと死ぬため、
 *    LearningWorkspacePage は onAdvance を渡していない。
 *    データ側の副作用は今までと同じ。
 */
export interface UseLessonCompletion {
  completedIds: Set<number>;
  isCompleted: boolean;
  completing: boolean;
  /** 完了/取り消し。onAdvance を渡した場合のみ、完了時に次のレッスンへ進める */
  toggleComplete: (markAsComplete: boolean) => Promise<void>;
}

export function useLessonCompletion(
  courseId: number,
  lessonId: number | null,
  allLessonIds: number[],
  onAdvance?: (nextLessonId: number) => void
): UseLessonCompletion {
  const { user } = useAuth();
  const { showToast } = useToast();
  const awardExp = useProgressionStore((s) => s.awardExp);

  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());
  const [completing, setCompleting] = useState(false);

  // レッスン選択時に完了状態を取得（既に完了済みならスキップ）
  useEffect(() => {
    if (!lessonId || completedIds.has(lessonId)) return;
    bffClient
      .getActivityCompletion(lessonId, courseId)
      .then((data) => {
        if (data?.state === 1 || data?.state === 2) {
          setCompletedIds((prev) => new Set(prev).add(lessonId));
        }
      })
      .catch(() => {}); // エラーは無視（完了未取得のまま継続）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, courseId]);

  const toggleComplete = useCallback(
    async (markAsComplete: boolean) => {
      if (!lessonId || completing) return;
      setCompleting(true);
      try {
        await bffClient.markActivityComplete(lessonId, markAsComplete);

        const newCompletedIds = new Set(completedIds);
        if (markAsComplete) {
          newCompletedIds.add(lessonId);
          awardExp(`lesson:${lessonId}`, EXP_RULES.LESSON_COMPLETE);
        } else {
          newCompletedIds.delete(lessonId);
        }
        setCompletedIds(newCompletedIds);

        if (user?.userid) {
          const progress_percent = allLessonIds.length > 0
            ? Math.round((newCompletedIds.size / allLessonIds.length) * 100)
            : 0;
          bffClient
            .updateResumeCourse(user.userid, { courseid: courseId, progress_percent })
            .catch((e) => console.error('[ResumeCourse] Update failed:', e?.response?.data?.message ?? e));

          // 完了時のみ次のレッスンへ遷移（onAdvance を渡した呼び出し元だけ）
          if (markAsComplete && onAdvance) {
            const nextId = allLessonIds[allLessonIds.indexOf(lessonId) + 1];
            if (nextId) onAdvance(nextId);
          }
        }
      } catch (e: any) {
        console.error('[Complete] Failed:', e?.response?.data?.message ?? e);
        showToast(
          markAsComplete
            ? '完了の記録に失敗しました。再度お試しください。'
            : '完了の取り消しに失敗しました。再度お試しください。',
          'error'
        );
      } finally {
        setCompleting(false);
      }
    },
    [lessonId, completing, completedIds, awardExp, user?.userid, allLessonIds, courseId, onAdvance, showToast]
  );

  return {
    completedIds,
    isCompleted: !!lessonId && completedIds.has(lessonId),
    completing,
    toggleComplete,
  };
}
