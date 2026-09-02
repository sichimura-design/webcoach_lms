/**
 * AIコーチングノート関連の型。
 * 実BFFには存在しない新機能。すべてモック（MSW）で返す。
 *
 * 体験の骨子:
 *   コーチから届いたリンクを貼る → LMSからコーチングに参加する → 終了後にノートとタスクが完成している
 *
 * 設計の要点:
 *  - 録画・文字起こしは**コーチの認証済み権限**で行う。受講生はアカウント連携をしない。
 *    そのため受講生側のボタンは「録音を開始」ではなく「AIノートを開始して参加」と表現する。
 *  - 受講生に入力させるのは会議リンクだけ。日時・コーチ名・サービス種別は貼り付けた文面から自動判定する。
 *  - AIが抽出した目標・タスクは、受講生が確認して確定するまで反映しない（GoalState）。
 *  - AI出力は構造化し、各項目に根拠となる発言ID（sourceSegmentIds）を紐づける。
 */

// ---- 会議プロバイダー ------------------------------------------------------

export type MeetingProviderId = 'zoom' | 'google_meet' | 'manual';

export const PROVIDER_LABEL: Record<MeetingProviderId, string> = {
  zoom: 'Zoom',
  google_meet: 'Google Meet',
  manual: '対面・その他',
};

/** 貼り付けられた文面から抽出した会議リンク */
export interface MeetingLink {
  provider: 'zoom' | 'google_meet';
  url: string;
  /** Meet は 'abc-defg-hij'、Zoom は会議ID。Webhook との照合キーになる */
  meetingId: string;
  /** Zoom のパスコード（URLの pwd= や本文の「パスコード: xxx」から拾う） */
  passcode: string | null;
}

// ---- 取り込み元 ------------------------------------------------------------

/**
 * 記録の入手経路。
 * 通常は auto_recording（コーチの連携経由で自動取得）だけで完結する。
 * 残りは、コーチが未連携・プラン非対応・自動取得に失敗したときのフォールバック。
 * 受講生自身に録音させる経路は持たない（相手の声が録れず、事故になるため）。
 */
export type RecordingSource =
  | 'auto_recording'      // コーチの Zoom / Meet 連携から自動取得
  | 'provider_transcript' // 文字起こしファイル（VTT/SRT/TXT）を手動で取り込み
  | 'uploaded_audio'      // 音声・動画ファイルを手動で取り込み
  | 'pasted_text';        // テキスト・メモを手動で入力

export const RECORDING_SOURCE_LABEL: Record<RecordingSource, string> = {
  auto_recording: '自動取得',
  provider_transcript: '文字起こしファイル',
  uploaded_audio: '録音・動画ファイル',
  pasted_text: 'テキスト・メモ',
};

/** 記録が自動で届いたのか、受講生が手で取り込んだのか */
export type ImportedFrom = 'auto' | 'manual';

// ---- 処理ステート ----------------------------------------------------------

export type SessionStatus =
  | 'draft'           // 記録がまだ何も取り込まれていない
  | 'recording'       // コーチング実施中（記録中）
  | 'uploading'
  | 'transcribing'    // 文字起こしが既にある経路ではスキップされる
  | 'summarizing'
  | 'review_required' // AI処理完了。受講生の確認待ち
  | 'published'       // 目標・タスクを確定済み
  | 'failed';

// ---- 文字起こし ------------------------------------------------------------

export type SpeakerRole = 'coach' | 'student' | 'unknown';

/** 発言単位の文字起こし。長文1本ではなくこの粒度で保持する */
export interface TranscriptSegment {
  id: string;          // 'seg_021'
  speakerId: string;   // 'speaker_1' | 'speaker_2' | 'unknown'
  speakerRole: SpeakerRole;
  startMs: number;
  endMs: number;
  text: string;
  confidence: number;
}

// ---- AIの構造化出力 --------------------------------------------------------

/** 根拠となる発言に紐づいた項目 */
export interface Evidenced {
  title: string;
  sourceSegmentIds: string[];
}

export type GoalState =
  | 'ai_suggested'       // AIが抽出した候補（確定前）
  | 'student_confirmed'  // 受講生が確認して確定した
  | 'shared_with_coach'
  | 'coach_confirmed'
  | 'completed';

export const GOAL_STATE_LABEL: Record<GoalState, string> = {
  ai_suggested: 'AIが抽出した候補',
  student_confirmed: '確定済み',
  shared_with_coach: 'コーチに共有済み',
  coach_confirmed: 'コーチと確認済み',
  completed: '完了',
};

/**
 * 次回までの目標・タスクの候補。
 * 会話から読み取れない項目は AI に補完させず null のままにして、受講生に入力してもらう。
 */
export interface GoalCandidate {
  id: string;
  title: string;
  /** null は「確認が必要」と表示する */
  successCriteria: string | null;
  /** null は「未設定」と表示する（YYYY-MM-DD） */
  dueDate: string | null;
  estimatedMinutes: number | null;
  priority: 'high' | 'normal' | 'low';
  sourceSegmentIds: string[];
  /** successCriteria / dueDate が欠けている＝受講生の入力が要る */
  needsReview: boolean;
  state: GoalState;
  selected: boolean;
}

/**
 * 会話から拾った要点のひとかたまり。
 * 見出しは回ごとにAIが付ける（「前回からの進捗」のような固定文言にしない）。
 * 何が話されたかは回によって違うので、毎回同じ4つの箱に押し込むと
 * 中身の無い見出しが残ったり、逆に収まらない話題が落ちたりしていた。
 */
export interface SummaryHighlight {
  heading: string;
  items: Evidenced[];
}

export interface CoachingAiSummary {
  /** 今回のまとめ */
  sessionSummary: string;
  /**
   * 会話の要点。見出しはAIが回ごとに付ける。
   * 🔴 実BFFはまだこれを返さないので optional。無いときは下の
   *    progressSinceLast / coachFeedback / decisions / nextSessionAgenda から組み立てる
   *    （SessionReview の conversationBlocks）。
   */
  highlights?: SummaryHighlight[];
  /** 前回からの進捗。前回の目標に対して進んだこと */
  progressSinceLast: Evidenced[];
  /** コーチからのフィードバック（改善点・アドバイス） */
  coachFeedback: Evidenced[];
  /** 決まったこと（会話内で合意された内容） */
  decisions: Evidenced[];
  /** 次回までの目標 */
  goals: GoalCandidate[];
  /** 次回までのタスク（具体的な行動） */
  tasks: GoalCandidate[];
  /** 次回確認すること */
  nextSessionAgenda: string[];
  /**
   * 要約時に参照したLMS内の情報。
   * 一般的な議事録ではなく学習進捗に紐づいた整理であることを、受講生に示すために表示する。
   */
  referencedContext: string[];
}

// ---- 同意 ------------------------------------------------------------------

/** 録音・文字起こし・AI要約への同意。初回のみ確認し、以降は省略する */
export interface RecordingConsent {
  agreed: boolean;
  agreedAt: string;
}

// ---- セッション ------------------------------------------------------------

/** 音声の保存期間 */
export type AudioRetention = 'keep_30d' | 'delete_after_summary';

/** 公開範囲 */
export type SessionVisibility = 'private' | 'shared_with_coach';

export interface CoachingSessionDetail {
  id: number;
  date: string;          // YYYY-MM-DD
  title: string;
  coach: string;
  coachId: number;
  meetingLink: MeetingLink | null;
  source: RecordingSource | null;
  importedFrom: ImportedFrom | null;
  status: SessionStatus;
  /** 進捗の日本語ラベル（「AIが内容を整理しています」など） */
  step: string;
  progress: number;      // 0-100
  error: string | null;
  audioRetention: AudioRetention;
  visibility: SessionVisibility;
  hasAudio: boolean;
  segments: TranscriptSegment[];
  summary: CoachingAiSummary | null;
  studentMemo: string;
  /** 学習目標へ反映済みの GoalCandidate.id */
  reflectedGoalIds: string[];
  reflectedAt: string | null;
}

/** 一覧表示用の軽量版（segments / summary を含まない） */
export interface CoachingSessionSummary {
  id: number;
  date: string;
  title: string;
  coach: string;
  summary: string;
  status: SessionStatus;
  source: RecordingSource | null;
  importedFrom: ImportedFrom | null;
  tasksCreated: boolean;
}

/** 次回コーチングの予定。受講生ダッシュボードのカードはこれを描画する */
export interface NextCoaching {
  date: string;          // 表示用日時（「8月10日(月) 10:00〜11:00」）
  /**
   * 開始日時（ISO8601）。「次回まであと何日」を出すために必要。
   * date は表示用の文字列で機械的に読めないため、日数計算をそこから起こさない。
   * 取れない場合は null にして、カウントダウンごと出さない。
   */
  startsAt: string | null;
  coach: string;
  coachId: number;
  meetingLink: MeetingLink | null;
  /** 進行中のセッション。記録中・生成中・確認待ちのときに入る */
  activeSessionId: number | null;
  activeStatus: SessionStatus | null;
}

/**
 * 次回コーチングでコーチに相談したいこと。
 * コーチング当日に「何を話すんだっけ」から始まらないよう、思いついたときに置いておく場所。
 */
export interface CoachingAgenda {
  text: string;
  updatedAt: string | null;
}

/** 相談したいことの文字数上限。長文はコーチングの場で話すべきなのでここでは受けない */
export const COACHING_AGENDA_MAX = 500;

export interface CoachingSessions {
  next: NextCoaching | null;
  past: CoachingSessionSummary[];
  /** 録音・文字起こし・AI要約への同意状況（初回のみ確認する） */
  consent: RecordingConsent | null;
}

// ---- 手動取り込み（フォールバック） ----------------------------------------

export interface ImportRecordPayload {
  source: RecordingSource;
  audio?: Blob;
  segments?: TranscriptSegment[];
  text?: string;
  audioRetention?: AudioRetention;
  fileName?: string;
}

/** セッションへの部分更新 */
export interface CoachingSessionPatch {
  studentMemo?: string;
  visibility?: SessionVisibility;
  audioRetention?: AudioRetention;
  segments?: TranscriptSegment[];
  goals?: GoalCandidate[];
  tasks?: GoalCandidate[];
  title?: string;
  date?: string;
}

// ---- コーチの録画連携 ------------------------------------------------------
//
// 録画・文字起こしの持ち主は会議の主催者（コーチ）なので、認可はコーチ側から取る。
// ただしコーチ用LMSは作らないため、運営が送る認証専用URL（/connect/:token）を
// 1回開いてもらうだけで完結させる。
//
// 重要な制約: 会議リンクを発行したアカウントと、LMSに連携したアカウントが一致している必要がある。

export type ConnectionStatus =
  | 'not_connected'
  | 'connected'
  | 'reauth_required'   // リフレッシュトークンが失効した
  | 'expired'           // 認証URLの期限切れ（未接続のまま期限を過ぎた）
  | 'plan_unsupported'  // Zoom無料 / 個人Googleアカウント → そもそも自動取得できない
  | 'revoked';          // コーチが連携を解除した

export const CONNECTION_STATUS_LABEL: Record<ConnectionStatus, string> = {
  not_connected: '未連携',
  connected: '連携済み',
  reauth_required: '再認証が必要',
  expired: '認証URL期限切れ',
  plan_unsupported: '利用できないプラン',
  revoked: '解除済み',
};

export interface MeetingConnection {
  id: string;
  coachId: number;
  coachName: string;
  coachEmail: string;
  provider: MeetingProviderId | null;
  status: ConnectionStatus;
  /** 'Zoom Pro' / 'Zoom 無料' / 'Google Workspace Business Standard' など */
  planLabel: string | null;
  /** plan_unsupported / reauth_required の理由文 */
  reason: string | null;
  connectedAt: string | null;
  lastAutoImportAt: string | null;
}

/**
 * コーチ向け認証URL。
 * 有効期限内なら再訪できる（解除後の再接続や、連携状態の確認に使うため）。
 * リンクを知っているだけでは接続できない — 実際の認可はプロバイダー側で
 * コーチ本人がログインして行うため、リンク自体は権限を持たない。
 */
export interface ConnectionInvite {
  token: string;
  coachId: number;
  coachName: string;
  coachEmail: string;
  expiresAt: string;
  /** basename 込みの絶対URL。運営がそのままコーチに渡せる形 */
  url: string;
  usedAt: string | null;
  /** 再送した回数 */
  resentCount: number;
}

/** 受講生側の事前チェック。自動で記録が届くと思わせておいて届かない、を防ぐ */
export type ReadinessIssueCode =
  | 'no_meeting_link'
  | 'coach_not_connected'
  | 'coach_reauth_required'
  | 'coach_plan_unsupported'
  | 'provider_mismatch';   // 会議リンクのサービスと、コーチが連携したサービスが違う

export interface AutoImportReadiness {
  ready: boolean;
  connection: MeetingConnection | null;
  issues: Array<{ code: ReadinessIssueCode; message: string }>;
}
