/**
 * frontend/src/types/lessonSearch.ts
 * コース内の教材本文検索（GET /api/webcoach/courses/:courseId/search）のドメイン型。
 *
 * このAPIは実BFF（FastAPI）に存在しない。バックエンドは変更禁止のため、
 * MSW（frontend/src/mocks/lessonSearch.ts）で提供している。
 * 型はモックとクライアント（bffClient）の双方から import して、
 * 片方だけがズレることを防ぐ（types/lesson.ts と同じ方針）。
 *
 * 設計上の要点:
 *   結果は「ブロックの羅列」ではなく**レッスン単位にまとめて**返す。
 *   探している人が知りたいのは「どのレッスンの話か」であって、
 *   ヒットした段落の総数ではないため。抜粋は手がかりとして各レッスンに数件添える。
 */

import type { LessonBlockKind, LessonState } from './lesson';

/** ヒットした本文の1箇所 */
export interface LessonSearchHit {
  /** ジャンプ先のアンカー。?block= に載せると教材ページがその段落まで飛ぶ */
  blockId: string;
  /** ブロックの見出し。「どういう文脈の話か」の手がかりになる */
  heading: string;
  kind: LessonBlockKind;
  /** ヒット語の前後を切り出した抜粋。前後を落としたときは … が付く */
  excerpt: string;
  /**
   * excerpt の中でのヒット語の位置。UI がここに <mark> を当てる。
   * 抜粋そのものを <mark> 入りのHTMLで返さないのは、
   * 表示側が dangerouslySetInnerHTML を使わずに済むようにするため。
   */
  matchStart: number;
  matchLength: number;
}

/** レッスン1本ぶんのまとまり */
export interface LessonSearchGroup {
  lessonId: number;
  lessonTitle: string;
  sectionId: number;
  sectionName: string;
  /** チャプターの通し番号（1始まり）。「CHAPTER 02」の表示に使う */
  sectionIndex: number;
  /** 完了／学習中／未学習。結果を見たまま進捗も分かるようにする */
  state: LessonState;
  /** このレッスン内の総ヒット数。hits は上限で間引くので一致しないことがある */
  hitCount: number;
  hits: LessonSearchHit[];
}

export interface LessonSearchResponse {
  courseId: number;
  /** サーバが実際に検索した語（前後の空白を落としたもの） */
  query: string;
  totalHits: number;
  /** ヒットしたレッスンの本数 */
  lessonCount: number;
  /** カリキュラム順。関連度順にはしない（「どの章の話か」を探しているため） */
  groups: LessonSearchGroup[];
}
