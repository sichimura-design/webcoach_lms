import { useEffect, useState } from 'react';
import { bffClient } from '../services/bffClient';
import { useRecentCourseStore } from '../store/recentCourseStore';

/**
 * マイページ「続きから学習」の中身（どのレッスンの続きか・何本中何本済みか）。
 *
 * 🔴 /webcoach/resumecourse はコース名と進捗％しか返さない。カードが出したい
 *    レッスン名・レッスン数は dev/miyabe のモックにしか無く、実バックエンドでは
 *    常にコース名＋「◯％完了」に落ちていた。ここで実 Moodle の目次
 *    （/moodle/courses/:id/contents。完了状態は BFF が付けてくれる）から組み立てる。
 *    教材ページ（CourseContentPage）と同じ目次・同じ数え方（全モジュール）なので、
 *    向こうで見る進み具合と食い違わない。
 *
 * 続きのレッスン = この端末で最後に開いたレッスン（recentCourseStore）。
 * 履歴が無ければ最初の未完了レッスン、全部済んでいれば先頭。
 */
export interface ResumeLesson {
  lessonId: number;
  lessonTitle: string;
  /** 目次の通し番号（1始まり） */
  lessonNo: number;
  totalLessons: number;
  completedLessons: number;
  /** completedLessons / totalLessons（0–100）。カードのレッスン数表記と必ず一致させるため */
  progress: number;
}

export function useResumeLesson(courseId: number | undefined): ResumeLesson | null {
  const recent = useRecentCourseStore((s) => s.entries.find((e) => e.courseId === courseId));
  const recentLessonId = recent?.lessonId;
  const [modules, setModules] = useState<{ id: number; name: string; done: boolean }[] | null>(null);

  useEffect(() => {
    setModules(null);
    if (!courseId) return;
    let cancelled = false;
    bffClient
      .getCourseContent(courseId)
      .then((sections) => {
        if (cancelled) return;
        const flat = (Array.isArray(sections) ? sections : []).flatMap((s: any) => s.modules ?? []);
        setModules(
          flat.map((m: any) => ({
            id: m.id,
            name: m.name ?? '',
            done: m.completiondata?.state === 1 || m.completiondata?.state === 2,
          }))
        );
      })
      // 取れなければカードは従来どおりコース名＋％表示に落ちる
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  if (!modules || modules.length === 0) return null;

  const target =
    (recentLessonId != null && modules.find((m) => m.id === recentLessonId)) ||
    modules.find((m) => !m.done) ||
    modules[0];
  const completedLessons = modules.filter((m) => m.done).length;

  return {
    lessonId: target.id,
    lessonTitle: target.name,
    lessonNo: modules.indexOf(target) + 1,
    totalLessons: modules.length,
    completedLessons,
    progress: (completedLessons / modules.length) * 100,
  };
}
