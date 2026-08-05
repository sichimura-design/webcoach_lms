/**
 * 学習アクティビティ（集中ブースのタイマー記録の永続単位）
 * ============================================================
 * 「セッション記録」ではなく「アクティビティ」として設計している理由:
 *   後からタイムライン／SNSシェア／応援リアクション／コメントを足すとき、
 *   行の意味（誰が・いつ・何をしたか）と中身（学習セッションの詳細）を分けておかないと
 *   kind 違いの行（レッスン完了・作品投稿など）を同じ配列に混ぜられず、
 *   データ構造を作り直すことになる。
 *   → 共通メタ（envelope）+ kind ごとの payload + social の3層に分ける。
 *
 * 集計値（日別/週別/月別・ストリーク・教材別）は一切保存しない。
 * 常にこの配列から utils/studyStats.ts の純関数で導出する。
 * 理由は utils/studyStats.ts のヘッダに記載。
 *
 * これらのAPIは実BFF（FastAPI）に存在しない。バックエンドは変更禁止のため、
 * すべて MSW（mocks/studyActivityHandlers.ts）で提供している。
 * ============================================================
 */
import { StudySessionMode } from './studyRoom';

/** 現状は学習セッションのみ。将来: 'lesson_complete' | 'artifact_posted' | 'milestone_reached' */
export type StudyActivityKind = 'study_session';

/**
 * 達成度。★1〜5 や % にはしない。
 * docs/design-token-spec.md の「理解度%等の学習効果を数値化した指標は表示しない」に触れるため。
 * 数値尺度にすると後から平均やグラフにされる余地が生まれる。3語のラベルなら自己申告の感覚だと伝わる。
 */
export type Achievement = 'low' | 'mid' | 'high';

export const ACHIEVEMENT_LABEL: Record<Achievement, string> = {
  low: 'もう少し',
  mid: 'できた',
  high: 'バッチリ',
};

/** 将来のタイムライン公開範囲。今回はすべて 'private' で入る */
export type StudyActivityVisibility = 'private' | 'followers' | 'public';

/** 学習した教材。「教材を指定しない」は null */
export interface StudyActivityCourseRef {
  courseId: number;
  courseTitle: string;
  lessonId?: number;
  lessonTitle?: string;
  /** 開始時点の教材進捗（%）。記録カードで「45% → 60%」を出すために持つ */
  progressPercentAtStart?: number;
  /** 終了時点の教材進捗（%）。要件の自動記録項目「教材の進捗」 */
  progressPercentAtEnd?: number;
}

export interface StudySessionPayload {
  mode: StudySessionMode;
  /** ポモドーロの設定時間。通常タイマーでも「目安」として入力されたら保持する */
  targetMinutes?: number;
  /** ★集計の唯一の権威。ユーザーが終了時に修正した値がそのまま入る */
  durationMinutes: number;
  /** 計測された実測秒。修正の有無を後から確認するためだけに持つ（集計には使わない） */
  measuredSeconds: number;
  /** durationMinutes が計測値から変更されたか */
  adjusted: boolean;
  pausedCount: number;
  pausedSeconds: number;
  /** ポモドーロの設定時間に到達したか */
  completedTarget: boolean;

  /** 今回の学習目標（任意・フリーテキスト） */
  goalText?: string | null;
  /** 以下は「内容を追加して記録」で入る任意項目 */
  contentNote?: string | null;
  memo?: string | null;
  achievement?: Achievement | null;

  /** 記録時点の今週累計（分）。表示用スナップショットで、集計には使わない */
  weeklyTotalMinutesAtEnd?: number;
}

/** 今回は誰も書き込まない。タイムライン／リアクション／コメントを足すときにここだけ埋まる */
export interface StudyActivitySocial {
  visibility: StudyActivityVisibility;
  reactionCounts: Record<string, number>;
  myReactions: string[];
  commentCount: number;
  sharedTo?: string[];
}

export interface StudyActivity {
  /** `sa-<startedAtMs>-<base36>`。クライアント生成 = POSTの冪等キー兼 EXP の eventId */
  id: string;
  userId: number;
  kind: StudyActivityKind;

  /** = endedAt。タイムラインの並び順の唯一の基準 */
  occurredAt: string;
  startedAt: string;
  endedAt: string;

  /**
   * ★集計の唯一の基準となる端末ローカル日（YYYY-MM-DD）。startedAt の日を入れる。
   * 23:50開始→00:30終了は「その日に学習した」として扱う（受講生の体感に合わせる）。
   * 判断を後から変えられるように endLocalDate も残す。
   * toISOString().slice(0,10) からは作らない（UTCになりJSTの深夜〜早朝が前日に落ちる）。
   */
  localDate: string;
  endLocalDate: string;
  /** 記録時の -new Date().getTimezoneOffset()。実BFF移行後にサーバ側で日を切るため */
  timezoneOffsetMinutes: number;

  course: StudyActivityCourseRef | null;
  /** kind='study_session' のときのペイロード。kind を増やすときは union にする */
  session: StudySessionPayload;
  social: StudyActivitySocial;

  createdAt: string;
  updatedAt: string;
  schemaVersion: 1;
}

/** POST body。id はクライアントで確定させる（冪等・EXPのeventIdが通信結果に依存しない） */
export type StudyActivityInput = Omit<
  StudyActivity,
  'userId' | 'createdAt' | 'updatedAt' | 'schemaVersion' | 'social'
> & { visibility?: StudyActivityVisibility };

// ---- 実行中のタイマー ------------------------------------------------------
// 型を store ではなくここに置くのは、utils/studyStats.ts がこれを参照するため。
// store 側に置くと store → utils → store の循環 import になる。

export interface ActiveStudySession {
  mode: StudySessionMode;
  /** 通常タイマーでも捨てない（捨てていたのが旧実装の不具合の原因） */
  targetMinutes?: number;
  courseId?: number;
  courseTitle?: string;
  lessonId?: number;
  lessonTitle?: string;
  progressPercentAtStart?: number;
  goalText?: string;
  /** epoch ms。一時停止のたび後ろにずれる（経過 = now - startedAt で計算し続けられる） */
  startedAt: number;
  /** 一時停止した時刻。null なら稼働中 */
  pausedAt: number | null;
  pausedCount: number;
  /** startedAt ずらしで失われる一時停止の合計。記録に残すため別に持つ */
  pausedTotalMs: number;
  /** 開始時に確定する。POSTが失敗してもEXPが二重加算されない鍵になる */
  activityId: string;
  /** ポモドーロ完了を検知した時刻。多重通知の防止 */
  targetReachedAt: number | null;
}

/** 終了カードの下書き。カード表示中のリロードで消えないよう store に永続化する */
export interface StudyFinishDraft {
  activityId: string;
  measuredSeconds: number;
  /** ユーザーが修正できる。初期値 = round(measuredSeconds / 60) */
  actualMinutes: number;
  goalText: string;
  contentNote: string;
  memo: string;
  achievement: Achievement | null;
  /** prepareFinish 時点のスナップショット */
  snapshot: {
    startedAt: string;
    endedAt: string;
    localDate: string;
    endLocalDate: string;
    timezoneOffsetMinutes: number;
    course: StudyActivityCourseRef | null;
    mode: StudySessionMode;
    targetMinutes?: number;
    pausedCount: number;
    pausedSeconds: number;
    completedTarget: boolean;
  };
}

// ---- 集計値の型 ------------------------------------------------------------
// APIのレスポンス形。実BFFにロールアップテーブルを置いてもフロントが変わらないよう、
// 「集計済みを受け取る」契約にしてある（実装は都度導出）。

export interface StudyDayTotal {
  /** YYYY-MM-DD */
  date: string;
  minutes: number;
  sessionCount: number;
  longestMinutes: number;
  /** minutes >= STUDY_DAY_MIN_MINUTES */
  isStudyDay: boolean;
}

export interface StudyStreak {
  currentDays: number;
  bestDays: number;
  /** 今月の学習日数 */
  monthStudyDays: number;
  /** 今日ぶんが成立しているか（「今日はあと○分」表示に使う） */
  todayAchieved: boolean;
  todayMinutes: number;
  thresholdMinutes: number;
}

export interface CourseStudyTotal {
  /** null = 教材を指定しなかったぶん */
  courseId: number | null;
  courseTitle: string;
  minutes: number;
  sessionCount: number;
  lastStudiedAt: string;
}

export interface StudyPeriodTotal {
  minutes: number;
  sessionCount: number;
  longestMinutes: number;
}

/** GET /webcoach/study-stats/{userId} */
export interface StudyStatsSummary {
  today: StudyPeriodTotal;
  /** 月曜始まり */
  week: StudyPeriodTotal;
  /** 前週比を出すため */
  lastWeek: StudyPeriodTotal;
  month: StudyPeriodTotal;
  allTime: StudyPeriodTotal;
  streak: StudyStreak;
  /** 直近 days 日分。欠損日も 0 で埋めて連続させる（グラフとカレンダーが共用） */
  dailyTotals: StudyDayTotal[];
  byCourse: CourseStudyTotal[];
  /** 最近の学習履歴。集中ブースの右下カードはこれだけで足りる */
  recent: StudyActivity[];
  generatedAt: string;
}

export interface StudyActivityQuery {
  from?: string;
  to?: string;
  courseId?: number;
  limit?: number;
  offset?: number;
}

export interface StudyActivityPage {
  items: StudyActivity[];
  total: number;
  hasMore: boolean;
}
