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
import { COURSE_ID_BY_SLUG as CATALOG_COURSE_ID } from '../constants/courseTaxonomy';
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
    /** 単元名（Clipkit の URL 階層に現れる章。例 chapter-02）。無いコースは空文字 */
    section: string;
    title: string;
    lead: string;
    goals: string[];
    estimatedMinutes: number;
    blocks: LessonBlock[];
    summary: string;
    nextAction: string;
    prev: { lessonId: number; title: string } | null;
    next: { lessonId: number; title: string } | null;
    css: string;
    origin: { url: string; htmlPath: string; extractedBy: string; splitBy: string };
  }>;
}

const ASSET_TOKEN = '__ASSET__';

/**
 * 移行コースに割り当てる courseId。
 *
 * 移行済み教材は「カタログに無い別枠のコース」ではなく、カタログのコースそのものにする。
 * 専用の帯（旧 901〜）に置いていた間はコース一覧から到達できず、courseId 直リンクだけで
 * 開ける状態だった。カタログIDを使えば一覧のタイルがそのまま実教材の入口になり、
 * レッスン数も courseLessonCount が移行コースを特別扱いして実数を返す。
 *
 * 注意: materials/lessons/ の残りのスラッグ（web-design・coding・sns など）は
 * コースではなく**学習領域サイズのバケツ**（web-design だけで144レッスン＝13コース分）。
 * 配置するときは領域ごと1コースにせず、コース単位に割り直してそれぞれのカタログIDを割り当てる。
 */
const COURSE_ID_BY_SLUG: Record<string, number> = {
  'ai-designer': CATALOG_COURSE_ID['ai-design'],
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
  /** レッスンID → 単元名。目次を単元ごとに分けるために持つ */
  sectionByLessonId: Map<number, string>;
}

/** 単元名の表示。`chapter-02` のような機械的な名前は「第2章」に読み替える。 */
function sectionLabel(name: string, index: number): string {
  const chapter = name.match(/^chapter[-_]?(\d+)$/i);
  if (chapter) {
    const n = Number(chapter[1]);
    return n === 0 ? 'はじめに' : `第${n}章`;
  }
  return name || `単元${index + 1}`;
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
    css: lesson.css || undefined,
  }));
  const sectionByLessonId = new Map(bundle.lessons.map((l) => [l.lessonId, l.section || '']));
  return { courseId, courseSlug: bundle.courseSlug, courseName: bundle.courseName, lessons, sectionByLessonId };
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
 * 目次。単元の区切りは Clipkit の URL 階層（chapter-02 など）に現れるので、
 * 変換時にレッスンへ持たせた section で分ける。
 * レッスンは学習順（章 → 章内の前後リンクの鎖）に並んでいる。
 */
export function migratedOutline(
  courseId: number,
  isDone: (lessonId: number) => boolean
): LessonOutline | null {
  const course = BY_COURSE_ID.get(courseId);
  if (!course) return null;

  const activeIndex = course.lessons.findIndex((l) => !isDone(l.lessonId));

  // 単元（Clipkit の章）ごとにまとめる。レッスンは学習順に並んでいるので、
  // 単元名が変わったところで区切れば順序を保ったまま分けられる。
  const sections: OutlineSection[] = [];
  course.lessons.forEach((lesson, index) => {
    const name = course.sectionByLessonId.get(lesson.lessonId) ?? '';
    const last = sections[sections.length - 1];
    const label = sectionLabel(name, sections.length);
    if (!last || last.name !== label) {
      sections.push({ id: courseId * 1000 + sections.length + 1, name: label, lessons: [] });
    }
    sections[sections.length - 1].lessons.push({
      lessonId: lesson.lessonId,
      title: lesson.title,
      minutes: lesson.estimatedMinutes,
      state: isDone(lesson.lessonId) ? 'done' : index === activeIndex ? 'active' : 'todo',
    });
  });

  const done = course.lessons.filter((l) => isDone(l.lessonId)).length;
  return {
    courseId,
    courseName: course.courseName,
    progressPercent: course.lessons.length ? Math.round((done / course.lessons.length) * 100) : 0,
    sections,
  };
}
