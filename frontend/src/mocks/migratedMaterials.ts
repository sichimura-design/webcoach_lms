/**
 * frontend/src/mocks/migratedMaterials.ts
 * Clipkit から移行した実教材を、モックの LessonDoc として供給する。
 *
 * データの出どころ:
 *   tools/lesson-convert が materials/lessons を変換して
 *     - レッスン本文 → src/mocks/materials/<course>.json（このファイルが import する）
 *     - 画像・動画   → public/materials/<course>/…（ビルドに含まれ、そのまま配信される）
 *   を書き出す。手で編集せず、再生成すること。
 *
 * 資産のURLについて:
 *   JSON 内の画像パスは `__ASSET__/images/…` というトークンで入っている。
 *   実際の URL は配信場所（ローカル / プレビューの /branches/<slug>/）で変わるため、
 *   PUBLIC_URL を見て読み込み時に解決する。
 *
 * 既存のダミー教材は残したまま、移行済みコースだけ実データに差し替える。
 * 差し替えたコースの courseId は MIGRATED_COURSE_IDS で引ける。
 */

import type { LessonBlock, LessonDoc, LessonOutline, OutlineSection } from '../types/lesson';
import aiDesigner from './materials/ai-designer.json';

/** 変換ツールが書き出す1コース分の形。LessonDoc に変換前の素の形。 */
interface MaterialBundle {
  courseSlug: string;
  courseName: string;
  assetBase: string;
  lessonCount: number;
  lessons: Array<{
    lessonId: number;
    slug: string;
    title: string;
    lead: string;
    goals: string[];
    estimatedMinutes: number;
    blocks: LessonBlock[];
    summary: string;
    nextAction: string;
    prev: { lessonId: number; title: string } | null;
    next: { lessonId: number; title: string } | null;
    origin: { url: string; htmlPath: string; extractedBy: string; splitBy: string };
  }>;
}

const ASSET_TOKEN = '__ASSET__';

/**
 * 移行コースに割り当てる courseId。
 * 既存のダミーコース（101〜229）と衝突しない帯を使う。
 */
const COURSE_ID_BY_SLUG: Record<string, number> = {
  'ai-designer': 901,
};

const BUNDLES: MaterialBundle[] = [aiDesigner as unknown as MaterialBundle];

/** `__ASSET__/images/x.webp` を配信URLに直す。PUBLIC_URL はプレビューだと /branches/<slug>。 */
function resolveAssets(html: string, assetBase: string): string {
  const base = `${process.env.PUBLIC_URL || ''}/${assetBase}`.replace(/\/{2,}/g, '/');
  return html.split(`${ASSET_TOKEN}/`).join(`${base}/`);
}

interface MigratedCourse {
  courseId: number;
  courseSlug: string;
  courseName: string;
  lessons: LessonDoc[];
}

/** 起動時に1度だけ組み立てる。JSONは静的importなので追加の通信は発生しない。 */
const COURSES: MigratedCourse[] = BUNDLES.map((bundle) => {
  const courseId = COURSE_ID_BY_SLUG[bundle.courseSlug];
  const lessons = bundle.lessons.map<LessonDoc>((lesson) => ({
    courseId,
    courseName: bundle.courseName,
    lessonId: lesson.lessonId,
    title: lesson.title,
    lead: lesson.lead,
    goals: lesson.goals,
    estimatedMinutes: lesson.estimatedMinutes,
    materialFormat: 'text',
    blocks: lesson.blocks.map((block) => ({
      ...block,
      html: resolveAssets(block.html, bundle.assetBase),
      ...(block.media
        ? { media: { ...block.media, src: resolveAssets(block.media.src, bundle.assetBase) } }
        : {}),
    })),
    summary: lesson.summary,
    nextAction: lesson.nextAction,
    prev: lesson.prev,
    next: lesson.next,
    source: 'structured',
  }));
  return { courseId, courseSlug: bundle.courseSlug, courseName: bundle.courseName, lessons };
});

const BY_COURSE_ID = new Map(COURSES.map((c) => [c.courseId, c]));

/** 移行済みコースの courseId 一覧。コース一覧やルーティングの分岐に使う。 */
export const MIGRATED_COURSE_IDS: number[] = COURSES.map((c) => c.courseId);

export function isMigratedCourse(courseId: number): boolean {
  return BY_COURSE_ID.has(courseId);
}

export function migratedCourseName(courseId: number): string | null {
  return BY_COURSE_ID.get(courseId)?.courseName ?? null;
}

export function migratedLessonCount(courseId: number): number {
  return BY_COURSE_ID.get(courseId)?.lessons.length ?? 0;
}

export function findMigratedLesson(courseId: number, lessonId: number): LessonDoc | null {
  return BY_COURSE_ID.get(courseId)?.lessons.find((l) => l.lessonId === lessonId) ?? null;
}

/**
 * 目次。移行教材は Clipkit 側に単元の区切りが無いので、
 * 1コース＝1単元として並べる（順序は変換時の lessonId 順で安定している）。
 */
export function migratedOutline(
  courseId: number,
  isDone: (lessonId: number) => boolean
): LessonOutline | null {
  const course = BY_COURSE_ID.get(courseId);
  if (!course) return null;

  const activeIndex = course.lessons.findIndex((l) => !isDone(l.lessonId));
  const sections: OutlineSection[] = [
    {
      id: courseId * 1000 + 1,
      name: course.courseName,
      lessons: course.lessons.map((lesson, index) => ({
        lessonId: lesson.lessonId,
        title: lesson.title,
        minutes: lesson.estimatedMinutes,
        state: isDone(lesson.lessonId) ? 'done' : index === activeIndex ? 'active' : 'todo',
      })),
    },
  ];

  const done = course.lessons.filter((l) => isDone(l.lessonId)).length;
  return {
    courseId,
    courseName: course.courseName,
    progressPercent: course.lessons.length ? Math.round((done / course.lessons.length) * 100) : 0,
    sections,
  };
}
