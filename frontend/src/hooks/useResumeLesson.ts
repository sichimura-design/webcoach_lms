import { useEffect, useMemo, useState } from 'react';
import { bffClient } from '../services/bffClient';
import { useRecentCourseStore } from '../store/recentCourseStore';

/**
 * マイページ「続きから学習」の中身（どのコースの・どのレッスンの続きか・何本中何本済みか）。
 *
 * 🔴 /webcoach/resumecourse はコース名と進捗％しか返さない。カードが出したい
 *    レッスン名・レッスン数は dev/miyabe のモックにしか無く、実バックエンドでは
 *    常にコース名＋「◯％完了」に落ちていた。ここで実 Moodle の目次
 *    （/moodle/courses/:id/contents）から組み立てる。
 *
 * 🔴 どのコースを出すかも、ここで候補を順に目次を見て決める。
 *    resumecourse はレッスンを完了したときにしか書かれないので、受講しただけの生徒には
 *    無い。そのとき受講一覧の先頭を機械的に選ぶと、アナウンスメントのフォーラムしか無い
 *    空のコースに当たり「アナウンスメント／0％完了」と出ていた（複数コース受講時）。
 *    候補（呼び出し側で優先順に並べる）の中で、レッスンを1本以上持つ最初のコースを採る。
 *    どれも持たなければ先頭の候補（レッスン情報なし＝コース名＋％表示）に落とす。
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
  /** レッスン総数（1以上） */
  totalLessons: number;
  completedLessons: number;
}

interface LessonModule {
  id: number;
  name: string;
  trackable: boolean;
  done: boolean;
}

/** 目次を見に行くコースの上限。受講数が多くても通信が膨らまないように */
const MAX_PROBES = 8;

async function loadModules(courseId: number): Promise<LessonModule[]> {
  const [sections, completion] = await Promise.all([
    bffClient.getCourseContent(courseId),
    bffClient.getCourseActivitiesCompletion(courseId).catch(() => null),
  ]);
  const stateByCmid = new Map((completion?.statuses ?? []).map((s) => [s.cmid, s.state] as const));
  const flat = (Array.isArray(sections) ? sections : []).flatMap((s: any) => s.modules ?? []);
  return flat.map((m: any) => ({
    id: m.id,
    name: m.name ?? '',
    trackable: (m.completion ?? 0) >= 1,
    done: (stateByCmid.get(m.id) ?? m.completiondata?.state ?? 0) >= 1,
  }));
}

/**
 * @param candidateIds 「続きから」に出してよいコースを優先順に。先頭ほど優先
 */
export function useResumeLesson(candidateIds: number[]): {
  /** 選んだコース。候補が無ければ undefined */
  courseId: number | undefined;
  lesson: ResumeLesson | null;
  /** 目次を取りに行っている間 true。カードはこの間レッスン名・進捗を仮表示にする */
  loading: boolean;
} {
  // 配列の同一性ではなく中身で effect を回す
  const key = candidateIds.join(',');
  const ids = useMemo(() => (key ? key.split(',').map(Number) : []), [key]);

  // 取得結果をどの候補列のものか込みで持つ。候補が変わった直後の1描画でも
  // 「取得中」と判定でき、前のコースの目次が一瞬見えることもない
  const [result, setResult] = useState<{
    key: string;
    courseId: number | undefined;
    modules: LessonModule[];
  } | null>(null);

  useEffect(() => {
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      // 1件ずつ順に見る。たいていは先頭で決まるので、全件並列に叩くより軽い
      for (const id of ids.slice(0, MAX_PROBES)) {
        const modules = await loadModules(id).catch(() => [] as LessonModule[]);
        if (cancelled) return;
        if (modules.some((m) => m.trackable)) {
          setResult({ key, courseId: id, modules });
          return;
        }
      }
      // レッスンのあるコースが無い → 先頭の候補をコース名＋％表示で出す
      if (!cancelled) setResult({ key, courseId: ids[0], modules: [] });
    })();
    return () => {
      cancelled = true;
    };
  }, [ids, key]);

  const loading = ids.length > 0 && result?.key !== key;
  const courseId = loading ? ids[0] : result?.courseId;
  const recent = useRecentCourseStore((s) => s.entries.find((e) => e.courseId === courseId));
  const recentLessonId = recent?.lessonId;

  const modules = !loading && result ? result.modules : [];
  const lessons = modules.filter((m) => m.trackable);
  // 🔴 レッスンが1本も無いコースで modules[0]（たいていアナウンスメントのフォーラム）を
  //    レッスン名として出さない。lesson=null でコース名＋％表示に落とす
  if (lessons.length === 0) return { courseId, lesson: null, loading };

  const target =
    (recentLessonId != null && modules.find((m) => m.id === recentLessonId)) ||
    lessons.find((m) => !m.done) ||
    lessons[0];
  const no = lessons.indexOf(target);

  return {
    courseId,
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
