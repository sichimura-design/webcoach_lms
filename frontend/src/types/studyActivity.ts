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

/**
 * 学習の活動カテゴリ。
 * ============================================================
 * 🔴 ユーザーには選ばせない。開いているページから自動で決める
 *    （utils/studyCategory.ts が唯一の判定）。「教材ですか？課題ですか？」と
 *    毎回聞かれるのが記録を面倒にする最大の原因なので、増やすときも
 *    「ページを見れば分かるか」を先に問うこと。
 * 🔴 'practice'（実践課題）は今は作っていない。実践課題を始める独立した操作が
 *    まだアプリに無く、レッスンの learningtype='assignment' という属性としてしか
 *    存在しないため。独立した体験になったら足す。
 * ============================================================
 */
export type StudyCategory = 'material' | 'ai' | 'coaching' | 'review' | 'other';

export const STUDY_CATEGORY_LABEL: Record<StudyCategory, string> = {
  material: '教材',
  ai: 'AIコーチ',
  coaching: 'コーチング',
  review: '復習',
  other: 'その他',
};

/** 表示順。内訳を出すときは必ずこの順に並べる（画面ごとに順が違うと比べられない） */
export const STUDY_CATEGORY_ORDER: StudyCategory[] = ['material', 'ai', 'coaching', 'review', 'other'];

/**
 * セッション内の連続した1区間。ページが変わってカテゴリが変わるたびに
 * 開いている区間を閉じ、次の区間を開く。
 *
 * 🔴 一時停止はセッションの startedAt を後ろにずらして表現する（studyTimerStore 参照）。
 *    そのとき「開いている区間」の startedAt も同じ量ずらすこと。ずらし忘れると
 *    区間の合計と sessionElapsedSeconds が食い違い、内訳の和が学習時間と合わなくなる。
 */
export interface StudySegment {
  category: StudyCategory;
  /** 区間の開始時刻（ms）。一時停止のたび後ろにずれる */
  startedAt: number;
  /** null = 進行中。閉じた区間だけ値が入る */
  endedAt: number | null;
}

/** 記録に残すカテゴリ別の内訳。合計は必ず durationMinutes*60 に一致させる（比例配分） */
export interface StudySegmentTotal {
  category: StudyCategory;
  seconds: number;
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

  /**
   * カテゴリ別の内訳。
   * 🔴 optional。この仕組みより前に記録された行には無い。集計側（categoryTotals）は
   *    無い行を course の有無から material / other に寄せて扱う。
   * 🔴 合計は durationMinutes*60 に一致する。ユーザーが終了カードで分数を修正したら
   *    比例配分し直すので、実測秒そのものではない。
   */
  segments?: StudySegmentTotal[];

  /**
   * 記録の出どころ。
   * 🔴 optional。この仕組みより前に記録された行には無いので、未定義は 'timer' として扱う
   *    （判定は utils/studyStats.ts の isManualEntry が唯一の実装）。
   * 🔴 StudySessionMode に 'manual' を足さないこと。あの union は
   *    studyTimerStore / SidebarStudyTimer / FinishSessionModal が分岐に使っていて、
   *    「計測していない記録」を混ぜるとタイマーUI全体が壊れる。出どころは別の軸。
   */
  entrySource?: 'timer' | 'manual';
}

/**
 * measuredSeconds / adjusted / entrySource と画面の印の対応。
 * ============================================================
 *   タイマー記録（無修正）   measured=実測  adjusted=false  entrySource=未定義  印なし
 *   終了カードで分数修正     measured=実測  adjusted=true   entrySource=未定義  印なし
 *   履歴から後で編集         measured=実測(変えない)         entrySource=変えない  「✎編集済み」
 *                            adjusted は duration!==round(measured/60) で再計算
 *   手動追加                 measured=0     adjusted=true   entrySource='manual'  「手動」
 *
 * 🔴 「編集済み」の印を adjusted に相乗りさせない。終了カードで45→50分にした記録と
 *    後から書き換えた記録が同じ印になり、印の意味が説明できなくなる。
 *    編集済みは updatedAt !== createdAt で判定する（isEditedEntry）。
 * 🔴 measuredSeconds は編集で書き換えない。「修正の有無を後から確認するためだけ」の
 *    実測値なので、書き換えると adjusted が意味を失う。
 * ============================================================
 */

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

  /**
   * カテゴリ別の区間。最後の要素だけ endedAt === null（進行中）。
   * ページを移動するたびに閉じて開き直すので、1セッションで何本にもなる。
   * 🔴 合計は必ず sessionElapsedSeconds と一致する（一時停止のずらしを区間にも波及させる）。
   */
  segments: StudySegment[];
  /**
   * 最後にユーザーの操作を観測した時刻（ms）。放置検知に使う。
   * ページ遷移・クリック・キー入力・タブが可視に戻ったときに更新する。
   */
  lastActiveAt: number;
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
    /** 実測のカテゴリ別内訳。記録時に durationMinutes へ比例配分し直す元になる */
    segments: StudySegmentTotal[];
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

export interface CategoryStudyTotal {
  category: StudyCategory;
  minutes: number;
  sessionCount: number;
}

export interface StudyPeriodTotal {
  minutes: number;
  sessionCount: number;
  longestMinutes: number;
}

/** 月別の合計。受講開始月〜今月を欠損なく並べる（月別グラフが飛ばないように） */
export interface StudyMonthTotal {
  /** YYYY-MM */
  month: string;
  minutes: number;
  sessionCount: number;
  /** isStudyDay を満たした日数。閾値判定を画面で再実装しないために持つ */
  studyDays: number;
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
  /** 活動カテゴリ別の累計。STUDY_CATEGORY_ORDER の順で、0分のカテゴリは含めない */
  byCategory: CategoryStudyTotal[];
  /** 最近の学習履歴 */
  recent: StudyActivity[];
  /**
   * 最古の記録の localDate。1件も無ければ null。
   * カレンダーが「どこまで遡れるか」の唯一の根拠。
   * 🔴 受講開始日にロードマップ（LearningPlan.phases[0].startDate）を使わないこと。
   *    先に学習を始めてから後日プランを作る導線があるので、プラン開始日を下限にすると
   *    それ以前の既存の記録がカレンダーから見えなくなる（データを隠す不具合になる）。
   */
  firstStudyDate: string | null;
  /** 受講開始月〜今月の月別。days に関係なく常に全期間ぶん返す（数十行なので軽い） */
  monthlyTotals: StudyMonthTotal[];
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

/**
 * PATCH body。保存済みの記録を後から直すためのもの（タイマーの止め忘れ・付け忘れの訂正）。
 *
 * 🔴 ここに無いフィールドは編集できない。特に measuredSeconds / mode / targetMinutes /
 *    pausedCount / pausedSeconds / completedTarget / social / weeklyTotalMinutesAtEnd は
 *    「そのとき実際に起きたこと」の記録なので、後から書き換えると記録の意味が消える。
 * 🔴 segments は直接受け取らない。durationMinutes から比例配分し直す
 *    （applyActivityPatch が rescaleSegments を通す）。
 */
export interface StudyActivityPatch {
  durationMinutes?: number;
  course?: StudyActivityCourseRef | null;
  goalText?: string | null;
  contentNote?: string | null;
  memo?: string | null;
  achievement?: Achievement | null;
  /**
   * 日付の付け替え。startedAt / endedAt / occurredAt も同じ日数だけずれる
   * （shiftActivityDates）。localDate だけ書き換えると「occurredAt = 並び順の
   * 唯一の基準」という約束と食い違い、日別の一覧が壊れる。
   */
  localDate?: string;
}

/**
 * 手動で足す記録（記録し忘れた分）の入力。
 * buildManualActivityInput が StudyActivityInput に変換する。
 * 専用の POST は作らず、既存の recordStudyActivity をそのまま使う。
 */
export interface ManualStudyEntryInput {
  /** クライアント生成。POST の冪等キー */
  id: string;
  localDate: string;
  durationMinutes: number;
  course: StudyActivityCourseRef | null;
  goalText?: string | null;
  contentNote?: string | null;
  memo?: string | null;
  achievement?: Achievement | null;
}
