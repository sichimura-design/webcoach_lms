import { useEffect, useState } from 'react';
import { bffClient } from '../services/bffClient';
import { useRecentCourseStore } from '../store/recentCourseStore';

/**
 * マイページ「続きから学習」の中身（どのレッスンの続きか・何本中何本済みか）。
 *
 * 🔴 /webcoach/resumecourse はコース名と進捗％しか返さない。カードが出したい
 *    レッスン名・レッスン数は dev/miyabe のモックにしか無く、実バックエンドでは
 *    常にコース名＋「◯％完了」に落ちていた。ここで実 Moodle の目次
 *    （/moodle/courses/:id/contents）から組み立てる。
 *
 * 🔴 数え方はコース目次（CourseTopPage）に揃える。
 *    - レッスン＝完了トラッキング対象（completion >= 1）のモジュールだけ。
 *      ラベル等の対象外モジュールまで数えると分母だけ膨らみ、目次の「◯/◯」と食い違う。
 *    - 完了＝受講生本人の完了状態（/courses/:id/activities/completion）で state >= 1。
 *      目次に付いてくる completiondata は BFF の接続ユーザー側の値が残ることがあるので正にしない
 *      （取れなかったときだけそちらに落とす）。
 *
 * 続きのレッスン = この端末で最後に開いたレッスン（recentCourseStore）。
 * 履歴が無ければ最初の未完了レッスン、全部済んでいれば先頭。
 */
export interface ResumeLesson {
  lessonId: number;
  lessonTitle: string;
  /** レッスンの通し番号（1始まり）。前回開いたのがレッスン外のモジュールなら無し */
  lessonNo?: number;
  /** レッスン総数。トラッキング対象が1本も無いコースは 0 */
  totalLessons: number;
  completedLessons: number;
}

interface LessonModule {
  id: number;
  name: string;
  trackable: boolean;
  done: boolean;
}

export function useResumeLesson(courseId: number | undefined): {
  lesson: ResumeLesson | null;
  /** 目次を取りに行っている間 true。カードはこの間レッスン名・進捗を仮表示にする */
  loading: boolean;
} {
  const recent = useRecentCourseStore((s) => s.entries.find((e) => e.courseId === courseId));
  const recentLessonId = recent?.lessonId;
  // 取得結果をどのコースのものか込みで持つ。courseId が変わった直後の1描画でも
  // 「取得中」と判定でき、前のコースの目次が一瞬見えることもない
  const [result, setResult] = useState<{ courseId: number; modules: LessonModule[] } | null>(null);

  useEffect(() => {
    if (!courseId) return;
    let cancelled = false;
    Promise.all([
      bffClient.getCourseContent(courseId),
      bffClient.getCourseActivitiesCompletion(courseId).catch(() => null),
    ])
      .then(([sections, completion]) => {
        if (cancelled) return;
        const stateByCmid = new Map(
          (completion?.statuses ?? []).map((s) => [s.cmid, s.state] as const)
        );
        const flat = (Array.isArray(sections) ? sections : []).flatMap((s: any) => s.modules ?? []);
        setResult({
          courseId,
          modules: flat.map((m: any) => ({
            id: m.id,
            name: m.name ?? '',
            trackable: (m.completion ?? 0) >= 1,
            done: (stateByCmid.get(m.id) ?? m.completiondata?.state ?? 0) >= 1,
          })),
        });
      })
      // 取れなければカードは従来どおりコース名＋％表示に落ちる
      .catch(() => {
        if (!cancelled) setResult({ courseId, modules: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const loading = !!courseId && result?.courseId !== courseId;
  const modules = !loading && result ? result.modules : [];
  if (modules.length === 0) return { lesson: null, loading };

  const lessons = modules.filter((m) => m.trackable);
  const target =
    (recentLessonId != null && modules.find((m) => m.id === recentLessonId)) ||
    lessons.find((m) => !m.done) ||
    lessons[0] ||
    modules[0];
  const no = lessons.indexOf(target);

  return {
    lesson: {
      lessonId: target.id,
      lessonTitle: target.name,
      lessonNo: no >= 0 ? no + 1 : undefined,
      totalLessons: lessons.length,
      completedLessons: lessons.filter((m) => m.done).length,
    },
    loading,
  };
}
