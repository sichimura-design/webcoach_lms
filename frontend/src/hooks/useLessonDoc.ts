import { useCallback, useEffect, useState } from 'react';
import { bffClient } from '../services/bffClient';
import { LessonDoc, LessonOutline } from '../types/lesson';
import { useRecentCourseStore } from '../store/recentCourseStore';
import {
  MoodleModule,
  getContentType,
  isVideoFile,
} from '../components/learning/moodleContent';

/**
 * コースの目次（単元＞レッスン）とレッスン本文をまとめて取得する。
 *
 * 構造化レッスンAPI（モック）が使えないとき——本番のようにモックOFFの環境——は
 * 実Moodleのコースコンテンツから「1ブロックだけの LessonDoc」を組み立てて返す。
 * この縮退モード（source: 'moodle-fallback'）では選択ツールバー・クリップ・
 * ブロック参照は成立しないため、UI側でそれらを出さない判断に使う。
 */
export interface UseLessonDoc {
  outline: LessonOutline | null;
  doc: LessonDoc | null;
  /** 目次を平坦化したもの。前後遷移と完了率の計算に使う */
  allLessonIds: number[];
  loading: boolean;
  error: string | null;
  /** fallback 時のみ。動画ファイルがあれば動画ブロックを描画する */
  videoUrl: string | null;
  reload: () => void;
}

/** Moodle のセクション配列から、目次と対象モジュールを取り出す */
function moodleToOutline(sections: any[], courseName: string, courseId: number, activeId: number): LessonOutline {
  return {
    courseId,
    courseName,
    progressPercent: 0,
    sections: (sections ?? []).map((s: any, si: number) => ({
      id: s.id ?? si,
      name: s.name ?? `単元${si + 1}`,
      lessons: (s.modules ?? []).map((m: any) => ({
        lessonId: m.id,
        title: m.name,
        minutes: 0,
        state: m.id === activeId ? ('active' as const) : ('todo' as const),
      })),
    })),
  };
}

function moodleToDoc(
  module: MoodleModule,
  flat: MoodleModule[],
  courseId: number,
  courseName: string
): LessonDoc {
  const index = flat.findIndex((m) => m.id === module.id);
  const html = module.content ?? module.description ?? '';
  return {
    courseId,
    courseName,
    lessonId: module.id,
    title: module.name,
    lead: '',
    goals: [],
    estimatedMinutes: 0,
    // 1ブロック。Moodle HTML は構造が保証されないため分割せず、そのまま iframe に渡す。
    blocks: [
      {
        id: `moodle-${module.id}`,
        heading: module.name,
        kind: 'text',
        html,
        plain: '',
      },
    ],
    summary: '',
    nextAction: '',
    prev: index > 0 ? { lessonId: flat[index - 1].id, title: flat[index - 1].name } : null,
    next: index >= 0 && index < flat.length - 1 ? { lessonId: flat[index + 1].id, title: flat[index + 1].name } : null,
    source: 'moodle-fallback',
    fallbackHtml: html,
    fallbackModname: getContentType(module),
  };
}

export function useLessonDoc(courseId: number, lessonId: number | null): UseLessonDoc {
  const [outline, setOutline] = useState<LessonOutline | null>(null);
  const [doc, setDoc] = useState<LessonDoc | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // 目次は本文より先に必要（レッスン未指定のとき先頭レッスンを決めるため）
    bffClient
      .getLessonOutline(courseId)
      .then(async (loadedOutline) => {
        const flat = loadedOutline.sections.flatMap((s) => s.lessons);
        const targetId = lessonId && flat.some((l) => l.lessonId === lessonId)
          ? lessonId
          : flat[0]?.lessonId;
        if (!targetId) throw new Error('レッスンがありません');

        const loadedDoc = await bffClient.getLessonDoc(courseId, targetId);
        if (cancelled) return;
        setOutline({
          ...loadedOutline,
          sections: loadedOutline.sections.map((s) => ({
            ...s,
            lessons: s.lessons.map((l) =>
              l.lessonId === targetId && l.state !== 'done' ? { ...l, state: 'active' as const } : l
            ),
          })),
        });
        setDoc(loadedDoc);
        setVideoUrl(null);
        setLoading(false);
      })
      .catch(async () => {
        // 構造化教材APIが無い（モックOFF）→ 実Moodleへフォールバック
        try {
          const [sections, courses] = await Promise.all([
            bffClient.getCourseContent(courseId),
            bffClient.getCourses(),
          ]);
          if (cancelled) return;
          const list = Array.isArray(sections) ? sections : [];
          const flat: MoodleModule[] = list.flatMap((s: any) => s.modules ?? []);
          const target = (lessonId && flat.find((m) => m.id === lessonId)) || flat[0];
          if (!target) throw new Error('コースコンテンツが空です');

          const name = courses.find((c: any) => c.id === courseId)?.fullname ?? '';
          setOutline(moodleToOutline(list, name, courseId, target.id));
          setDoc(moodleToDoc(target, flat, courseId, name));
          const video = target.contents?.find((c) => isVideoFile(c.filename));
          setVideoUrl(video?.fileurl ?? null);
          setLoading(false);
        } catch (e: any) {
          if (cancelled) return;
          setError(e?.message || 'レッスンの読み込みに失敗しました。');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [courseId, lessonId, nonce]);

  // 「最近開いたレッスン」の履歴に残す。集中ブースのレッスン選択がこれを読む。
  // /webcoach/resumecourse はレッスンを完了したときだけ更新されるので、
  // 「開いただけのレッスン」を覚えている場所が別に必要だった（端末ごとの履歴）。
  useEffect(() => {
    if (!doc) return;
    useRecentCourseStore.getState().touch({
      courseId: doc.courseId,
      courseTitle: doc.courseName,
      lessonId: doc.lessonId,
      lessonTitle: doc.title,
      progressPercent: outline?.progressPercent,
    });
  }, [doc, outline?.progressPercent]);

  const allLessonIds = (outline?.sections ?? []).flatMap((s) => s.lessons.map((l) => l.lessonId));

  return { outline, doc, allLessonIds, loading, error, videoUrl, reload };
}
