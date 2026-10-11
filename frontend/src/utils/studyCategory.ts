/**
 * 「いま何をしている時間か」をURLから決める。
 * ============================================================
 * 🔴 ここが活動カテゴリ判定の唯一の実装。ユーザーには絶対に選ばせない。
 *    「教材ですか？課題ですか？AI相談ですか？」と毎回聞かれることが、
 *    学習記録を面倒にする最大の原因だという整理からこの設計になっている。
 *
 * 🔴 ルート判定がアプリ内で3箇所目にならないよう、レッスン本文かどうかの
 *    判定（isLessonPath）もここに集約した。以前は AppHeader のアクティブ判定と
 *    FloatingStudyTimer の非表示条件に別々の正規表現が書かれていた。
 *
 * 🔴 「実践課題」カテゴリは今は作っていない。実践課題を始める独立した操作が
 *    アプリに無く、レッスンの learningtype='assignment' という属性としてしか
 *    存在しないため。将来のために categoryOfPath は lesson を受け取れる形に
 *    してあるので、独立した体験になったらここだけ変えれば足りる。
 * ============================================================
 */
import type { StudyCategory } from '../types/studyActivity';

/** レッスン本文ページ `/course/123`。`/course/123/curriculum` は含まない */
const LESSON_PATH = /^\/course\/\d+$/;

export function isLessonPath(pathname: string): boolean {
  return LESSON_PATH.test(pathname);
}

/** レッスン本文の courseId。本文ページでなければ null */
export function courseIdOfPath(pathname: string): number | null {
  const m = pathname.match(/^\/course\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

/** 将来 learningtype で実践課題を分けるための受け口。今は使っていない */
export interface CategoryHints {
  learningType?: string;
}

export function categoryOfPath(pathname: string, _hints?: CategoryHints): StudyCategory {
  // AIコーチの個別アプリ（/ai-coach/apps/:appId）もAIコーチ。以前は完全一致で「その他」になっていた
  if (pathname === '/ai-coach' || pathname.startsWith('/ai-coach/')) return 'ai';
  if (pathname === '/coaching') return 'coaching';
  if (pathname.startsWith('/notes')) return 'review';
  if (
    pathname.startsWith('/course/') ||
    pathname === '/courses' ||
    pathname.startsWith('/courses/') ||
    pathname === '/learning-courses'
  ) {
    return 'material';
  }
  // トップ・学習記録・ロードマップ・設定など。学習中に立ち寄っても記録は止めないが、
  // 「教材を読んでいた時間」に混ぜてしまうと内訳が嘘になるので別扱いにする。
  return 'other';
}

/**
 * 計測中の区間のカテゴリ。ページのカテゴリに、記録に付いている教材を加味する。
 *
 * 🔴 教材を選んで記録している回は、教材以外の画面（マイページ・集中ブース・学習記録など
 *    ページのカテゴリが 'other' の画面）にいる時間も「教材」として数える。
 *    マイページで教材を選んで始め、紙やエディタで手を動かしていた時間が
 *    ほとんど「その他」になってしまっていた（2026-10 ユーザー指摘）。
 *    教材を選んだ時点で「その教材の学習時間」という意思表示とみなす。
 * 🔴 AIコーチ・コーチング・復習（マイノート）はそのまま。教材を選んでいても
 *    そこにいる時間は、その活動の時間として分けて見せる。
 * 🔴 教材を選んでいない回は今までどおり「その他」（アプリの外での学習時間）。
 */
export function sessionCategoryOf(pageCategory: StudyCategory, hasCourse: boolean): StudyCategory {
  return pageCategory === 'other' && hasCourse ? 'material' : pageCategory;
}

/**
 * 「学習を始めましたね」と見なすページかどうか。ここに着いたときだけ記録を打診する。
 *
 * 🔴 教材カタログ（/courses）とコーストップ（/course/:id/curriculum）は入れない。
 *    探している・目次を見ているだけの人に毎回ポップを出すと鬱陶しいだけになる。
 *    実際に本文・相談・コーチング・ノートを開いた瞬間だけに絞る。
 */
export function isStudyEntryPath(pathname: string): boolean {
  return (
    isLessonPath(pathname) ||
    pathname === '/ai-coach' ||
    pathname === '/coaching' ||
    pathname.startsWith('/notes')
  );
}
