// 自習室機能（ギルドロビーの「自習室に入室する」から始まるタイマー学習）

export type StudySessionMode = 'pomodoro' | 'freeform';

export interface StudySessionInput {
  mode: StudySessionMode;
  targetMinutes?: number;
  courseId?: number;
  courseTitle?: string;
  durationMinutes: number;
  startedAt: string; // ISO
  endedAt: string; // ISO
}

export interface StudySessionRecord extends StudySessionInput {
  id: number;
}
