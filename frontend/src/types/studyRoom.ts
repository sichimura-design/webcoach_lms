// 集中ブースのタイマー学習に関する型。
//
// 🔴 記録の永続単位は types/studyActivity.ts の StudyActivity に移した。
//    後からタイムライン／SNSシェア／リアクションを足せるようにするため、
//    フラットな「セッション記録」ではなく共通メタ + payload の構造にしてある。
//    このファイルに残っているのは、タイマーの種類（実行中のセッションが参照する）だけ。

export type StudySessionMode = 'pomodoro' | 'freeform';

export const STUDY_SESSION_MODE_LABEL: Record<StudySessionMode, string> = {
  pomodoro: 'ポモドーロ',
  freeform: '通常タイマー',
};

/**
 * @deprecated StudyActivity（types/studyActivity.ts）に置き換わった。
 * 参照が0になったら削除する。
 */
export interface StudySessionInput {
  mode: StudySessionMode;
  targetMinutes?: number;
  courseId?: number;
  courseTitle?: string;
  durationMinutes: number;
  startedAt: string; // ISO
  endedAt: string; // ISO
}

/** @deprecated StudyActivity（types/studyActivity.ts）に置き換わった。 */
export interface StudySessionRecord extends StudySessionInput {
  id: number;
}
