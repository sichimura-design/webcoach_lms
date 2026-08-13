import axios, { AxiosInstance } from 'axios';
import {
  UserInfo,
  Category,
  CreateActivityRequest,
  Badge,
  UserBadge,
  Profile,
  ProfileUpdate,
  ResumeCourse,
  UpdateResumeCourseRequest,
  Roadmap,
  RoadmapQueryParams,
  AIRequest,
  AIResponse,
  UpdateDBRequest,
  UpdateDBResponse,
  HealthResponse,
} from '../types/api';
import { CoachingGoalApi, CoachingGoalUpdateItem, DailyTodo, StreakInfo, CommunityPulse, Journey } from '../types/mypage';
import {
  StudyActivity,
  StudyActivityInput,
  StudyActivityPage,
  StudyActivityQuery,
  StudyStatsSummary,
} from '../types/studyActivity';
import { FocusBoothMember, FocusBoothPulse } from '../types/focusBooth';
import {
  AutoImportReadiness,
  CoachingSessions,
  CoachingSessionDetail,
  CoachingSessionPatch,
  ConnectionInvite,
  ImportRecordPayload,
  MeetingConnection,
  MeetingLink,
  MeetingProviderId,
  NextCoaching,
  RecordingConsent,
} from '../types/coaching';
import {
  LessonAiRequest,
  LessonAiResponse,
  LessonDoc,
  LessonOutline,
} from '../types/lesson';
import { AiSkillRequest, AiSkillResponse } from '../types/aiSkill';
import { NoteCreateInput, NoteItem, NoteListQuery } from '../types/notes';
import {
  CheckinAnswers,
  CheckinPrompt,
  ChoiceQuestion,
  IntakeAnswers,
  LearningPlan,
  LearningPlanPatch,
  MilestoneTemplate,
  PlanRevision,
  RevisionAction,
} from '../types/learningPlan';
import { getIdToken } from './cognitoAuth';
import { MOCKS_ENABLED } from '../mocks/config';

/**
 * BFF Client - 統合APIクライアント
 * swagger.yamlに準拠
 */

// BFFのベースURL
const BFF_BASE_URL = process.env.REACT_APP_BFF_URL
  ? `${process.env.REACT_APP_BFF_URL}/api`
  : '/api';

// ログイン画面のパス。BrowserRouter の basename（= PUBLIC_URL）を含める。
// 本番は PUBLIC_URL が空なので従来どおり '/login'、dev プレビューでは
// '/branches/<slug>/login' になる。
const LOGIN_PATH = `${process.env.PUBLIC_URL || ''}/login`;

class BFFClient {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: BFF_BASE_URL,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // リクエスト時にCognito IDトークンを付与
    this.api.interceptors.request.use(async (config) => {
      const token = await getIdToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // モック環境（ローカル / dev プレビュー）の 401 は「モック漏れのリクエストが
          // 実BFFに抜けた」ことを意味する。擬似トークンが弾かれただけなのでログイン画面へ
          // 飛ばす意味が無く、飛ばすと作業が中断されるだけなので警告に留める。
          if (MOCKS_ENABLED) {
            console.warn(
              '[mock] 401 from real BFF — このエンドポイントのモックが不足しています:',
              error.config?.method?.toUpperCase(),
              error.config?.url
            );
          } else if (window.location.pathname !== LOGIN_PATH) {
            // 🔴 basename 込みで飛ばすこと。'/login' 直書きだとサブパス配信
            //    （/branches/<slug>/）でSPAの外に出てしまい AccessDenied になる。
            window.location.href = LOGIN_PATH;
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // ==================== 通知 ====================

  async getNewContent(since: number): Promise<{ count: number; items: Array<{ type: string; id: number; name: string; timemodified: number }> }> {
    const response = await this.api.get('/moodle/notifications/new-content', { params: { since } });
    return response.data;
  }

  // ==================== Health ====================

  /**
   * ヘルスチェック
   * GET /health
   */
  async health(): Promise<HealthResponse> {
    const response = await this.api.get('/health');
    return response.data;
  }

  // ==================== コンテンツ認証 ====================

  /**
   * Lambda@Edge 認証用の短命トークンを取得
   * GET /api/content-token
   */
  async getContentToken(): Promise<{ token: string; expiresAt: number }> {
    const response = await this.api.get('/content-token');
    return response.data;
  }

  // ==================== ユーザー ====================

  /**
   * 現在のユーザー情報を取得
   * GET /api/user/info
   */
  async getUserInfo(): Promise<UserInfo> {
    const response = await this.api.get('/user/info');
    return response.data;
  }

  // ==================== Moodle コース ====================

  /**
   * 全コース取得
   * GET /api/moodle/courses
   * @returns Moodleのコース配列（APIは定義以上のフィールドを返す場合がある）
   */
  async getCourses(): Promise<any[]> {
    const response = await this.api.get('/moodle/courses');
    return response.data;
  }

  /**
   * ユーザーの受講コース取得
   * GET /api/moodle/courses/{userid}
   * @returns Moodleのコース配列
   */
  async getUserCourses(userId: number): Promise<any[]> {
    const response = await this.api.get(`/moodle/courses/${userId}`);
    return response.data;
  }

  /**
   * コース登録（エンロール）
   * POST /api/moodle/enroll-course/{courseid}
   */
  async enrollCourse(courseId: number): Promise<{ success: boolean }> {
    const response = await this.api.post(`/moodle/enroll-course/${courseId}`);
    return response.data;
  }

  /**
   * コース検索
   * GET /api/moodle/courses/search
   * @returns Moodleのコース配列
   */
  async searchCourses(query: string): Promise<any[]> {
    const response = await this.api.get('/moodle/courses/search', {
      params: { q: query }
    });
    return response.data;
  }

  /**
   * カテゴリ一覧取得
   * GET /api/moodle/categories
   */
  async getCategories(): Promise<Category[]> {
    const response = await this.api.get('/moodle/categories');
    return response.data;
  }

  /**
   * コースコンテンツ取得
   * GET /api/moodle/courses/{courseid}/contents
   * @returns コースコンテンツ配列（APIは定義以上のフィールドを返す場合がある）
   */
  async getCourseContent(courseid: number): Promise<any[]> {
    const response = await this.api.get(`/moodle/courses/${courseid}/contents`);
    return response.data;
  }

  /**
   * アクティビティ完了状態取得
   * GET /api/moodle/activities/{cmid}/completion?courseid={courseid}
   */
  async getActivityCompletion(cmid: number, courseid: number): Promise<any> {
    const response = await this.api.get(`/moodle/activities/${cmid}/completion`, { params: { courseid } });
    return response.data;
  }

  /**
   * アクティビティ完了マーク
   * POST /api/moodle/activities/{cmid}/completion
   */
  async markActivityComplete(cmid: number, completed: boolean = true): Promise<any> {
    const response = await this.api.post(`/moodle/activities/${cmid}/completion`, { completed });
    return response.data;
  }

  /**
   * アクティビティ作成
   * POST /api/moodle/courses/{courseid}/activities
   */
  async createActivity(
    courseid: number,
    activityData: CreateActivityRequest
  ): Promise<any> {
    const response = await this.api.post(
      `/moodle/courses/${courseid}/activities`,
      activityData
    );
    return response.data;
  }

  /**
   * フィールドでコース取得
   * GET /api/moodle/getcoursebyfield
   */
  async getCourseByField(field: string, value: string): Promise<any> {
    const response = await this.api.get('/moodle/getcoursebyfield', {
      params: { field, value }
    });
    return response.data;
  }

  /**
   * ファイルアップロード
   * POST /api/moodle/files/upload
   */
  async uploadFile(file: File, courseid: number): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('courseid', courseid.toString());

    const response = await this.api.post('/moodle/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  /**
   * 汎用Moodle API呼び出し
   * POST /api/moodle/api
   */
  async callMoodleAPI<T>(
    wsfunction: string,
    params: Record<string, any> = {}
  ): Promise<T> {
    const response = await this.api.post('/moodle/api', { wsfunction, params });
    return response.data;
  }

  // ==================== Moodle バッジ ====================

  /**
   * バッジ一覧取得
   * GET /api/moodle/badges
   */
  async getBadges(): Promise<Badge[]> {
    const response = await this.api.get('/moodle/badges');
    return response.data;
  }

  /**
   * ユーザーバッジ取得
   * GET /api/moodle/user-badges/{userid}
   */
  async getUserBadges(userId: number): Promise<UserBadge[]> {
    const response = await this.api.get(`/moodle/user-badges/${userId}`);
    return response.data;
  }

  // ==================== WebCoach ====================

  /**
   * ユーザープロフィール取得
   * GET /api/webcoach/profile/{userid}
   */
  async getUserProfile(userId: number): Promise<Profile> {
    const response = await this.api.get(`/webcoach/profile/${userId}`);
    return response.data;
  }

  /**
   * ユーザープロフィール更新
   * POST /api/webcoach/profile/{userid}
   */
  async updateUserProfile(
    userId: number,
    profileData: ProfileUpdate
  ): Promise<Profile> {
    const response = await this.api.post(
      `/webcoach/profile/${userId}`,
      profileData
    );
    return response.data;
  }

  /**
   * 再開コース取得
   * GET /api/webcoach/resumecourse/{userid}
   */
  async getResumeCourses(userId: number, limit: number = 5): Promise<ResumeCourse[]> {
    const response = await this.api.get(`/webcoach/resumecourse/${userId}`, {
      params: { limit }
    });
    return response.data;
  }

  /**
   * 再開コース更新
   * POST /api/webcoach/resumecourse/{userid}
   */
  async updateResumeCourse(
    userId: number,
    data: UpdateResumeCourseRequest
  ): Promise<ResumeCourse> {
    const response = await this.api.post(
      `/webcoach/resumecourse/${userId}`,
      data
    );
    return response.data;
  }

  /**
   * おすすめバッジ取得
   * GET /api/webcoach/recomendbadge/{userid}
   */
  async getRecommendedBadges(userId: number): Promise<Badge[]> {
    const response = await this.api.get(`/webcoach/recomendbadge/${userId}`);
    return response.data;
  }

  /**
   * ロードマップ一覧取得
   * GET /api/webcoach/roadmaps
   */
  async getRoadmaps(params?: RoadmapQueryParams): Promise<Roadmap[]> {
    const response = await this.api.get('/webcoach/roadmaps', { params });
    return response.data;
  }

  /**
   * ロードマップ詳細取得
   * GET /api/webcoach/roadmap/{roadmapid}
   */
  async getRoadmapDetail(roadmapId: number): Promise<Roadmap> {
    const response = await this.api.get(`/webcoach/roadmap/${roadmapId}`);
    return response.data;
  }

  /**
   * 次回コーチングまでの目標一覧取得
   * GET /api/webcoach/next-coaching-goals/{userid}
   */
  async getNextCoachingGoals(userId: number): Promise<CoachingGoalApi[]> {
    const response = await this.api.get(`/webcoach/next-coaching-goals/${userId}`);
    return response.data;
  }

  /**
   * 次回コーチングまでの目標全件取得（管理者用）
   * GET /api/webcoach/next-coaching-goals
   */
  async getAllNextCoachingGoals(): Promise<CoachingGoalApi[]> {
    const response = await this.api.get('/webcoach/next-coaching-goals');
    return response.data;
  }

  /**
   * 次回コーチングまでの目標一括更新（作成・更新・削除・並び替え）
   * PUT /api/webcoach/next-coaching-goals/{userid}
   */
  async updateNextCoachingGoals(
    userId: number,
    goals: CoachingGoalUpdateItem[]
  ): Promise<CoachingGoalApi[]> {
    const response = await this.api.put(`/webcoach/next-coaching-goals/${userId}`, { goals });
    return response.data;
  }

  /**
   * 今日のTODO取得
   */
  async getDailyTodos(userId: number): Promise<DailyTodo[]> {
    const response = await this.api.get(`/webcoach/daily-todos/${userId}`);
    return response.data;
  }

  /**
   * 今日のTODO更新（完了状態の切り替え）
   */
  async updateDailyTodos(userId: number, todos: DailyTodo[]): Promise<DailyTodo[]> {
    const response = await this.api.put(`/webcoach/daily-todos/${userId}`, { todos });
    return response.data;
  }

  /**
   * 学習ストリーク（連続学習日数・週間の学習有無）取得
   */
  async getStreak(userId: number): Promise<StreakInfo> {
    const response = await this.api.get(`/webcoach/streak/${userId}`);
    return response.data;
  }

  /**
   * おすすめコース取得（実践課題／復習教材の2バケット）
   */
  /**
   * 「次におすすめ」3枠（実践／関連／1歩先）。
   * 実BFFには存在しない新機能。mocks/handlers.ts の MSW モックが応答する。
   * 🔴 モックOFF（本番）では 501 になる。呼び出し側は「取得できない＝セクションを出さない」に縮退させる
   */
  async getNextCourses(userId: number): Promise<any[]> {
    const response = await this.api.get('/webcoach/recommend-courses', { params: { userid: userId } });
    return response.data;
  }

  /**
   * コミュニティの盛り上がり（カテゴリ別の直近学習人数。ユーザー単位ではない集計値）
   */
  async getCommunityPulse(): Promise<CommunityPulse> {
    const response = await this.api.get('/webcoach/community-pulse');
    return response.data;
  }

  // ==================== 集中ブース: 学習アクティビティ ====================
  // 実BFFには存在しない新機能。すべて mocks/studyActivityHandlers.ts の MSW モックが応答する。
  // 🔴 モックOFF（本番）では 404 になる。呼び出し側は「取得できない＝統計を出さない」に縮退させる
  //    （タイマー自体は動く。hooks/useStudyStats.ts の unavailable を参照）。

  /**
   * 学習アクティビティを記録する
   * POST /api/webcoach/study-activities/{userId}
   * id はクライアント生成で、同じ id の再送は既存を返す（冪等）。
   */
  async recordStudyActivity(userId: number, input: StudyActivityInput): Promise<StudyActivity> {
    const response = await this.api.post(`/webcoach/study-activities/${userId}`, input);
    return response.data;
  }

  /**
   * 学習履歴（新しい順・ページング）
   * GET /api/webcoach/study-activities/{userId}?from&to&courseId&limit&offset
   */
  async getStudyActivities(
    userId: number,
    query: StudyActivityQuery = {}
  ): Promise<StudyActivityPage> {
    const response = await this.api.get(`/webcoach/study-activities/${userId}`, { params: query });
    return response.data;
  }

  /**
   * 今日/今週/今月・ストリーク・日別・教材別・最近の履歴をまとめて取得する
   * GET /api/webcoach/study-stats/{userId}?days=35
   * 画面はこれ1本で描けるようにしてある（リクエストを増やさない）。
   */
  async getStudyStats(userId: number, days = 35): Promise<StudyStatsSummary> {
    const response = await this.api.get(`/webcoach/study-stats/${userId}`, { params: { days } });
    return response.data;
  }

  /**
   * 学習アクティビティを1件削除する
   * DELETE /api/webcoach/study-activities/{userId}/{activityId}
   */
  async deleteStudyActivity(userId: number, activityId: string): Promise<{ ok: boolean }> {
    const response = await this.api.delete(`/webcoach/study-activities/${userId}/${activityId}`);
    return response.data;
  }

  /**
   * 【モック確認用】学習アクティビティを消して、今日起点の過去数週間ぶんを再シードする。
   * ストリーク・カレンダー・グラフの見た目を作り直したいときに DevTools から叩く。
   * 実BFF実装時に持っていく想定ではない。
   */
  async resetStudyActivities(userId: number, seed = true): Promise<{ ok: boolean; count: number }> {
    const response = await this.api.post(
      `/webcoach/study-activities/${userId}/reset`,
      null,
      { params: { seed } }
    );
    return response.data;
  }

  /**
   * 学習ジャーニー（ロードマップ＋今日のクエスト＋ストリーク）
   */
  async getJourney(userId: number): Promise<Journey> {
    const response = await this.api.get(`/webcoach/journey/${userId}`);
    return response.data;
  }

  // ==================== AIコーチングノート ====================
  // 実BFFには存在しない新機能。すべて MSW モックで応答する。

  /**
   * コーチングセッション一覧（次回予約・過去の記録）
   * GET /api/webcoach/coaching-sessions/{userid}
   */
  async getCoachingSessions(userId: number): Promise<CoachingSessions> {
    const response = await this.api.get(`/webcoach/coaching-sessions/${userId}`);
    return response.data;
  }

  /**
   * 会議リンクを次回コーチングに登録する
   * PUT /api/webcoach/coaching-sessions/{userid}/meeting-link
   *
   * 受講生はコーチから届いたメッセージを貼り付けるだけ。URLの抽出とサービス判定は
   * クライアント側（utils/parseMeetingLink.ts）で済ませてから送る。
   */
  async registerMeetingLink(userId: number, link: MeetingLink): Promise<NextCoaching> {
    const response = await this.api.put(`/webcoach/coaching-sessions/${userId}/meeting-link`, link);
    return response.data;
  }

  /**
   * 録音・文字起こし・AI要約への同意を記録する（初回のみ）
   * PUT /api/webcoach/coaching-sessions/{userid}/consent
   */
  async setCoachingConsent(userId: number): Promise<RecordingConsent> {
    const response = await this.api.put(`/webcoach/coaching-sessions/${userId}/consent`, {
      agreed: true,
      agreedAt: new Date().toISOString(),
    });
    return response.data;
  }

  /**
   * AIノートを開始してコーチングに参加する
   * POST /api/webcoach/coaching-sessions/{userid}/start
   *
   * 受講生の端末で録音を始めるものではない。コーチの認証済み権限を使って
   * 会議側の記録機能を有効化し、セッションを recording 状態にする。
   */
  async startCoachingSession(userId: number): Promise<CoachingSessionDetail> {
    const response = await this.api.post(`/webcoach/coaching-sessions/${userId}/start`);
    return response.data;
  }

  /**
   * 【モック専用】コーチング終了 → 録画・文字起こしの取得とAI生成を開始する
   * POST /api/webcoach/coaching-sessions/{sessionId}/finish
   *
   * 実運用ではプロバイダーの Webhook（recording.transcript_completed 等）が起点になるため、
   * このエンドポイントは本番に存在しない。
   */
  async finishCoachingSession(sessionId: number): Promise<CoachingSessionDetail> {
    const response = await this.api.post(`/webcoach/coaching-sessions/${sessionId}/finish`);
    return response.data;
  }

  /**
   * セッション詳細（文字起こし・AI要約・処理状況）
   * GET /api/webcoach/coaching-sessions/detail/{sessionId}
   * 処理中はこのエンドポイントをポーリングして status の遷移を見る。
   */
  async getCoachingSession(sessionId: number): Promise<CoachingSessionDetail> {
    const response = await this.api.get(`/webcoach/coaching-sessions/detail/${sessionId}`);
    return response.data;
  }

  /**
   * 【フォールバック】記録を手動で取り込んでAI処理を開始する
   * POST /api/webcoach/coaching-sessions/{sessionId}/import
   *
   * 通常は自動取得で完結する。この経路はコーチが未連携・プラン非対応・
   * 自動取得に失敗したときだけ使う。
   *
   * 音声/動画の実体はこのAPIには通さない。1時間規模の音声・動画をAPIサーバーの
   * メモリと帯域に通すのは無理があるため、本番では presigned URL でブラウザから
   * ストレージへ直接アップロードし、ここにはそのメタデータだけを送る設計にする
   * （frontend/docs/ai-coaching-notes-design.md「6. 音声ファイルの保存」）。
   */
  async importCoachingRecord(
    sessionId: number,
    payload: ImportRecordPayload,
  ): Promise<CoachingSessionDetail> {
    const response = await this.api.post(`/webcoach/coaching-sessions/${sessionId}/import`, {
      source: payload.source,
      segments: payload.segments,
      text: payload.text,
      audioRetention: payload.audioRetention,
      fileName: payload.fileName,
      // 音声そのものではなくサイズだけ。本番ではアップロード済みオブジェクトのキーになる
      audioSizeBytes: payload.audio?.size,
    });
    return response.data;
  }

  /**
   * セッションの部分更新（メモ・公開範囲・保存期間・話者ラベル・目標/タスクの編集）
   * PATCH /api/webcoach/coaching-sessions/detail/{sessionId}
   */
  async updateCoachingSession(
    sessionId: number,
    patch: CoachingSessionPatch,
  ): Promise<CoachingSessionDetail> {
    const response = await this.api.patch(`/webcoach/coaching-sessions/detail/${sessionId}`, patch);
    return response.data;
  }

  /**
   * 選んだ目標候補を確定する（ai_suggested → student_confirmed）
   * POST /api/webcoach/coaching-sessions/{sessionId}/confirm-goals
   */
  async confirmCoachingGoals(
    sessionId: number,
    goalIds: string[],
  ): Promise<CoachingSessionDetail> {
    const response = await this.api.post(
      `/webcoach/coaching-sessions/${sessionId}/confirm-goals`,
      { goalIds },
    );
    return response.data;
  }

  /**
   * コーチング記録を削除する（音声・文字起こしを含む）
   * DELETE /api/webcoach/coaching-sessions/detail/{sessionId}
   */
  async deleteCoachingSession(sessionId: number): Promise<void> {
    await this.api.delete(`/webcoach/coaching-sessions/detail/${sessionId}`);
  }

  /**
   * 次回コーチング予定の更新
   * PUT /api/webcoach/coaching-sessions/{userid}/next
   */
  async updateNextCoaching(userId: number, next: Partial<NextCoaching>): Promise<NextCoaching> {
    const response = await this.api.put(`/webcoach/coaching-sessions/${userId}/next`, next);
    return response.data;
  }

  // ==================== Zoom / Meet 連携（自動取り込み） ====================
  // 録画・文字起こしの持ち主は会議の主催者（コーチ）なので、認可はコーチ側から取る。
  // ただしコーチにLMSアカウントは無い前提。運営が初回セットアップで接続リンクを発行し、
  // コーチはそのリンクを1回開いて認可するだけで済ませる。

  /**
   * コーチごとの接続状態一覧（運営画面用）
   * GET /api/webcoach/meeting-connections
   */
  async getMeetingConnections(): Promise<{ connections: MeetingConnection[] }> {
    const response = await this.api.get('/webcoach/meeting-connections');
    return response.data;
  }

  /**
   * 接続リンクを一括発行する（コーチの初回セットアップで使う）
   * POST /api/webcoach/meeting-connections/invites
   *
   * baseUrl は呼び出し側で組み立てて渡す。dev-preview はサブパス配信のため、
   * origin だけでなく PUBLIC_URL も含めないとコーチが開けないリンクになる。
   */
  async createConnectionInvites(
    coachIds: number[],
    baseUrl: string,
  ): Promise<{ invites: ConnectionInvite[] }> {
    const response = await this.api.post('/webcoach/meeting-connections/invites', { coachIds, baseUrl });
    return response.data;
  }

  /**
   * 接続リンクの内容を取得する
   * GET /api/webcoach/meeting-connections/invites/{token}
   *
   * 【認証不要】コーチはLMSアカウントを持たないため、このエンドポイントだけは
   * 未ログインで到達できる必要がある。本番実装でも Authorization を必須にしないこと。
   */
  async getConnectionInvite(token: string): Promise<{
    invite: ConnectionInvite;
    connection: MeetingConnection | null;
    expired: boolean;
  }> {
    const response = await this.api.get(`/webcoach/meeting-connections/invites/${token}`);
    return response.data;
  }

  /**
   * 接続を完了する（本番は OAuth コールバック後の処理に相当）
   * POST /api/webcoach/meeting-connections/invites/{token}/complete
   *
   * 【認証不要】上記と同じ理由。
   * simulateFreePlan / simulateFailure はモック専用で、
   * プラン非対応・認証失敗時の見え方を確認するためのもの。
   */
  async completeConnectionInvite(
    token: string,
    provider: MeetingProviderId,
    simulateFreePlan = false,
    simulateFailure = false,
  ): Promise<MeetingConnection> {
    const response = await this.api.post(
      `/webcoach/meeting-connections/invites/${token}/complete`,
      { provider, simulateFreePlan, simulateFailure },
    );
    return response.data;
  }

  /**
   * 接続を解除する
   * DELETE /api/webcoach/meeting-connections/{id}
   */
  async disconnectMeetingConnection(connectionId: string): Promise<MeetingConnection> {
    const response = await this.api.delete(`/webcoach/meeting-connections/${connectionId}`);
    return response.data;
  }

  /**
   * 自動取り込みの事前チェック
   * GET /api/webcoach/coaching-auto-import/readiness/{userid}
   *
   * 「自動で届きます」と表示しておいて実は届かない、を防ぐために使う。
   */
  async getAutoImportReadiness(userId: number): Promise<AutoImportReadiness> {
    const response = await this.api.get(`/webcoach/coaching-auto-import/readiness/${userId}`);
    return response.data;
  }

  /**
   * 認証URLを再送する（運営画面から。既存トークンを無効化して新しく発行し直す）
   * POST /api/webcoach/meeting-connections/{coachId}/resend
   */
  async resendConnectionInvite(coachId: number, baseUrl: string): Promise<ConnectionInvite> {
    const response = await this.api.post(
      `/webcoach/meeting-connections/${coachId}/resend`,
      { baseUrl },
    );
    return response.data;
  }

  /**
   * 集中ブース: 雰囲気（集中中人数・応援フィード件数等）
   */
  async getFocusBoothPulse(): Promise<FocusBoothPulse> {
    const response = await this.api.get('/webcoach/focus-booth/pulse');
    return response.data;
  }

  /**
   * 集中ブース: 在室メンバー
   */
  async getFocusBoothMembers(): Promise<FocusBoothMember[]> {
    const response = await this.api.get('/webcoach/focus-booth/members');
    return response.data;
  }

  /**
   * 集中ブース: メンバーを応援する
   */
  async cheerFocusBoothMember(memberId: string): Promise<FocusBoothMember> {
    const response = await this.api.post(`/webcoach/focus-booth/members/${memberId}/cheer`);
    return response.data;
  }

  /**
   * AIチャット
   * POST /api/webcoach/ai
   */
  async sendAIMessage(request: AIRequest): Promise<AIResponse> {
    const response = await this.api.post('/webcoach/ai', request);
    return response.data;
  }

  /**
   * データベース更新
   * POST /api/webcoach/updatedb
   */
  async updateDatabase(request: UpdateDBRequest): Promise<UpdateDBResponse> {
    const response = await this.api.post('/webcoach/updatedb', request);
    return response.data;
  }

  /**
   * 当日追加した教材をFAISSベクターDBに登録
   * POST /api/faiss/ingest/today
   */
  async faissIngestToday(): Promise<any> {
    const response = await this.api.post('/faiss/ingest/today');
    return response.data;
  }

  /**
   * 全教材をFAISSベクターDBに登録
   * POST /api/faiss/ingest/all
   */
  async faissIngestAll(): Promise<any> {
    const response = await this.api.post('/faiss/ingest/all');
    return response.data;
  }

  /**
   * アバター一覧取得
   * GET /api/webcoach/avatars
   */
  async getAvatars(): Promise<Array<{ avatar_id: number; url: string }>> {
    const response = await this.api.get('/webcoach/avatars');
    return response.data;
  }

  /**
   * アバター一括登録・更新・削除
   * POST /api/webcoach/avatars
   */
  async upsertAvatars(avatars: Array<{
    avatar_id?: number;
    url?: string;
    updateFlag?: boolean;
    deleteFlag?: boolean;
  }>): Promise<{
    success: boolean;
    created: number;
    updated: number;
    deleted: number;
    message: string;
    errors?: Array<{ index: number; message: string }>;
  }> {
    const response = await this.api.post('/webcoach/avatars', { avatars });
    return response.data;
  }

  /**
   * カテゴリ別タグ・コース情報取得
   * GET /api/webcoach/tags/{categoryid}
   */
  async getTagsByCategoryId(categoryId: number): Promise<any> {
    const response = await this.api.get(`/webcoach/tags/${categoryId}`);
    return response.data;
  }

  /**
   * AIアプリ一覧取得
   * GET /api/webcoach/ai-applications
   */
  async getAIApplications(): Promise<any[]> {
    const response = await this.api.get('/webcoach/ai-applications');
    const data = response.data;
    return Array.isArray(data) ? data : (data?.applications ?? []);
  }

  /**
   * コース作成
   * POST /api/moodle/create-course
   */
  async createCourse(courses: any[]): Promise<any> {
    const response = await this.api.post('/moodle/create-course', { courses });
    return response.data;
  }

  /**
   * カテゴリ作成
   * POST /api/moodle/create-category
   */
  async createCategories(categories: any[]): Promise<any> {
    const response = await this.api.post('/moodle/create-category', { categories });
    return response.data;
  }

  /**
   * Cognitoユーザー一括作成
   * POST /api/admin/cognito-users
   */
  async createCognitoUsers(records: any[]): Promise<any> {
    const response = await this.api.post('/admin/cognito-users', { records });
    return response.data;
  }

  /**
   * ロール別ユーザー一覧取得 (Cognito)
   * GET /api/admin/users/by-role/:role
   */
  async getUsersByRole(role: string): Promise<{
    role: string;
    count: number;
    users: Array<{
      userId: string;
      username: string;
      email: string;
      status: string;
      enabled: boolean;
      createdAt: string;
      lastModified: string;
      moodleUserId?: number;
    }>;
  }> {
    const response = await this.api.get(`/admin/users/by-role/${role}`);
    return response.data;
  }

  /**
   * 受講生一覧取得
   * GET /api/admin/students
   */
  async getStudents(): Promise<{
    students: Array<{
      id: number;
      username: string;
      email: string;
      firstname: string;
      lastname: string;
      fullname: string;
      lastaccess: number;
      lastaccess_formatted: string;
      firstaccess: number;
      suspended: boolean;
      auth: string;
      inactive_over_month: boolean;
      new_user: boolean;
    }>;
  }> {
    const response = await this.api.get('/admin/students');
    return response.data;
  }

  /**
   * Cognitoユーザー一覧取得
   * GET /api/admin/cognito-users
   */
  async getCognitoUsers(): Promise<any[]> {
    const response = await this.api.get('/admin/cognito-users');
    const data = response.data;
    return Array.isArray(data) ? data : (data?.users ?? []);
  }

  /**
   * 画像をS3にアップロード
   * POST /api/admin/s3-upload
   * @returns { success: boolean, s3Key: string, url: string }
   */
  async uploadToS3(file: File, s3Key: string): Promise<{ success: boolean; s3Key: string; url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('s3Key', s3Key);
    const response = await this.api.post('/admin/s3-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  }

  /**
   * 全コーチ・受講生マッピング取得
   * GET /api/coaching/mappings
   */
  async getAllCoachingMappings(includeDeleted = false): Promise<Array<{
    coach_user_id: number;
    student_user_id: number;
    logical_deleted: number;
    created_at: string;
    updated_at: string;
  }>> {
    const response = await this.api.get('/coaching/mappings', {
      params: includeDeleted ? { include_deleted: true } : undefined,
    });
    return response.data;
  }

  /**
   * コーチ・受講生マッピング登録
   * POST /api/coaching/mappings
   */
  async createCoachingMapping(
    coach_user_id: number,
    student_user_id: number,
    updateFlag = 0,
    deleteFlag = 0,
  ): Promise<any> {
    const response = await this.api.post('/coaching/mappings', {
      coach_user_id,
      student_user_id,
      updateFlag,
      deleteFlag,
    });
    return response.data;
  }

  /**
   * コース画像取得（Base64）
   * GET /api/moodle/course-image?path={relativePath}
   * @param imageUrl - Moodleの画像URL（フルURLまたは相対パス）
   * @returns Base64エンコードされた画像データ（文字列またはオブジェクト）
   */
  async getCourseImage(imageUrl: string): Promise<any> {
    // Moodleのpluginfile URLはパスだけ抽出してBFFに渡す（BFF側でMoodle tokenを付与する）
    // それ以外のフルURL（CloudFrontなど）はそのまま渡す（BFFがそのままフェッチ）
    const isMoodlePluginFile =
      imageUrl.includes('/pluginfile.php') || imageUrl.includes('/webservice/');

    let param: string;
    if (isMoodlePluginFile) {
      try {
        const url = new URL(imageUrl);
        param = decodeURIComponent(url.pathname) + url.search;
      } catch {
        try {
          param = decodeURIComponent(imageUrl);
        } catch {
          param = imageUrl;
        }
        if (!param.startsWith('/')) {
          param = '/' + param;
        }
      }
    } else {
      param = imageUrl;
    }

    const response = await this.api.get('/moodle/course-image', {
      params: { path: param }
    });
    return response.data;
  }

  // ==================== 教材学習ワークスペース（モック） ====================
  //
  // 実BFFには存在しないエンドポイント群。frontend/src/mocks/lessonHandlers.ts が
  // MSW で応答する。モックOFF（本番）では 404 になるため、呼び出し側
  // （hooks/useLessonDoc.ts）が実Moodle教材へフォールバックする。
  // 仕様は frontend/docs/learning-workspace-design.md を参照。

  /**
   * 教材目次（コース内のセクション＋レッスン一覧）
   * GET /api/webcoach/courses/{courseId}/outline
   */
  async getLessonOutline(courseId: number): Promise<LessonOutline> {
    const response = await this.api.get(`/webcoach/courses/${courseId}/outline`);
    return response.data;
  }

  /**
   * 教材本文（ブロック配列）
   * GET /api/webcoach/courses/{courseId}/lessons/{lessonId}
   */
  async getLessonDoc(courseId: number, lessonId: number): Promise<LessonDoc> {
    const response = await this.api.get(`/webcoach/courses/${courseId}/lessons/${lessonId}`);
    return response.data;
  }

  /**
   * 教材に準拠したAI回答（結論／根拠／当てはめ／次にやること／参照箇所）
   * POST /api/webcoach/lesson-ai
   */
  async askLessonAi(request: LessonAiRequest): Promise<LessonAiResponse> {
    const response = await this.api.post('/webcoach/lesson-ai', request);
    return response.data;
  }

  /**
   * AIコーチの専門モードを実行する（項目別添削・文章改善など）
   * POST /api/webcoach/ai-skill
   *
   * 実BFFには未実装。すべて mocks/aiSkillHandlers.ts のMSWモックが応答する。
   * 本番ではこのエンドポイントが Dify 呼び出しの唯一の境界になり、
   * BFF が skillId を Difyアプリの資格情報へ解決して代理呼び出しする。
   * フロントはアプリIDやURLを一切持たない（ユーザーにも見せない）。
   */
  async runAiSkill(request: AiSkillRequest): Promise<AiSkillResponse> {
    const response = await this.api.post('/webcoach/ai-skill', request);
    return response.data;
  }

  /**
   * 教材単位のメモ下書き取得
   * GET /api/webcoach/lesson-notes/{lessonId}
   */
  async getLessonMemo(lessonId: number): Promise<{ text: string; updatedAt: string | null }> {
    const response = await this.api.get(`/webcoach/lesson-notes/${lessonId}`);
    return response.data;
  }

  /**
   * 教材単位のメモ下書き保存（自動保存）
   * PUT /api/webcoach/lesson-notes/{lessonId}
   */
  async putLessonMemo(lessonId: number, text: string): Promise<{ text: string; updatedAt: string }> {
    const response = await this.api.put(`/webcoach/lesson-notes/${lessonId}`, { text });
    return response.data;
  }

  /**
   * マイノート横断取得（メモ・クリップ・保存したAI回答）
   * GET /api/webcoach/notes?kind={kind}&q={q}&courseId={courseId}&lessonId={lessonId}
   */
  async listNotes(query: NoteListQuery = {}): Promise<NoteItem[]> {
    const response = await this.api.get('/webcoach/notes', { params: query });
    return response.data;
  }

  /**
   * ノート作成（メモカード／クリップ／⭐保存したAI回答）
   * POST /api/webcoach/notes
   */
  async createNote(body: NoteCreateInput): Promise<NoteItem> {
    const response = await this.api.post('/webcoach/notes', body);
    return response.data;
  }

  /**
   * ノート削除
   * DELETE /api/webcoach/notes/{id}
   */
  async deleteNote(id: string): Promise<void> {
    await this.api.delete(`/webcoach/notes/${id}`);
  }

  // ==================== 学習ロードマップ（LearningPlan） ====================
  // 実BFFには未実装。すべて mocks/learningPlanHandlers.ts のMSWモックが応答する。

  /**
   * 学習ロードマップの取得（未作成なら null）
   * GET /api/webcoach/learning-plan/{userId}
   */
  async getLearningPlan(userId: number): Promise<LearningPlan | null> {
    const response = await this.api.get(`/webcoach/learning-plan/${userId}`);
    return response.data ?? null;
  }

  /**
   * 初回質問の定義取得（質問文を画面にベタ書きしないため）
   * GET /api/webcoach/learning-plan/intake-questions
   */
  async getIntakeQuestions(): Promise<ChoiceQuestion[]> {
    const response = await this.api.get('/webcoach/learning-plan/intake-questions');
    return response.data;
  }

  /**
   * マイルストーン候補テンプレートの取得
   * GET /api/webcoach/learning-plan/milestone-templates
   */
  async getMilestoneTemplates(phaseKey?: string): Promise<MilestoneTemplate[]> {
    const response = await this.api.get('/webcoach/learning-plan/milestone-templates', {
      params: phaseKey ? { phaseKey } : undefined,
    });
    return response.data;
  }

  /**
   * 初回質問への回答を送り、標準ロードマップを自動生成する
   * POST /api/webcoach/learning-plan/{userId}/intake
   */
  async submitIntake(userId: number, answers: IntakeAnswers): Promise<LearningPlan> {
    const response = await this.api.post(`/webcoach/learning-plan/${userId}/intake`, answers);
    return response.data;
  }

  /**
   * 期間・マイルストーンの調整を保存する
   * PATCH /api/webcoach/learning-plan/{userId}
   */
  async updateLearningPlan(userId: number, patch: LearningPlanPatch): Promise<LearningPlan> {
    const response = await this.api.patch(`/webcoach/learning-plan/${userId}`, patch);
    return response.data;
  }

  /**
   * 「コーチと確認しました」を記録する
   * POST /api/webcoach/learning-plan/{userId}/confirm
   * コーチはLMSを操作しない運用のため、押すのは受講生本人（コーチングの場で一緒に確認する）。
   */
  async confirmLearningPlan(userId: number, coachName: string | null): Promise<LearningPlan> {
    const response = await this.api.post(`/webcoach/learning-plan/${userId}/confirm`, { coachName });
    return response.data;
  }

  /**
   * 月次チェックインの質問と回答状況
   * GET /api/webcoach/learning-plan/{userId}/checkin
   */
  async getPlanCheckin(userId: number): Promise<CheckinPrompt> {
    const response = await this.api.get(`/webcoach/learning-plan/${userId}/checkin`);
    return response.data;
  }

  /**
   * 月次チェックインに回答する。更新すべき点があれば更新案が返る（無ければ null）
   * POST /api/webcoach/learning-plan/{userId}/checkin
   */
  async submitPlanCheckin(userId: number, answers: CheckinAnswers): Promise<PlanRevision | null> {
    const response = await this.api.post(`/webcoach/learning-plan/${userId}/checkin`, answers);
    return response.data ?? null;
  }

  /**
   * 更新案の一覧（未操作で溜まった分も含む）
   * GET /api/webcoach/learning-plan/{userId}/revisions
   */
  async getPlanRevisions(userId: number): Promise<PlanRevision[]> {
    const response = await this.api.get(`/webcoach/learning-plan/${userId}/revisions`);
    return response.data;
  }

  /**
   * 更新案への回答（提案どおり / 期間だけ / 現状を維持 / 選んだ項目だけ）
   * POST /api/webcoach/learning-plan/{userId}/revisions/{revisionId}/resolve
   */
  async resolvePlanRevision(
    userId: number,
    revisionId: string,
    action: RevisionAction,
    selectedDiffIds?: string[],
  ): Promise<{ plan: LearningPlan; revision: PlanRevision }> {
    const response = await this.api.post(
      `/webcoach/learning-plan/${userId}/revisions/${revisionId}/resolve`,
      { action, selectedDiffIds },
    );
    return response.data;
  }

  /**
   * ロードマップを削除して初回設定からやり直す
   * POST /api/webcoach/learning-plan/{userId}/reset
   * **モック確認用**のエンドポイント。実BFF実装時に持っていく想定ではない。
   */
  async resetLearningPlan(userId: number): Promise<void> {
    await this.api.post(`/webcoach/learning-plan/${userId}/reset`);
  }
}

export const bffClient = new BFFClient();
export default bffClient;
