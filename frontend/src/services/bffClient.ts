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
  StudyNote,
  UpdateStudyNoteRequest,
  CoachingSchedule,
  CreateCoachingScheduleRequest,
  UpdateCoachingScheduleRequest,
  Roadmap,
  RoadmapQueryParams,
  AIRequest,
  AIResponse,
  UpdateDBRequest,
  UpdateDBResponse,
  HealthResponse,
} from '../types/api';
import { CoachingGoalApi, CoachingGoalUpdateItem } from '../types/mypage';
import {
  StudySession,
  ActiveStudySessionInfo,
  StudyStats,
  StudyStreak,
  StudyCalendarData,
  StudyRanking,
  CourseAccess,
  CourseMaterialAccess,
} from '../types/studyActivity';
import { getIdToken } from './cognitoAuth';

/**
 * BFF Client - 統合APIクライアント
 * swagger.yamlに準拠
 */

// BFFのベースURL
const BFF_BASE_URL = process.env.REACT_APP_BFF_URL
  ? `${process.env.REACT_APP_BFF_URL}/api`
  : '/api';

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
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
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
   * 学習メモ取得
   * GET /api/webcoach/study-note/{userid}/{courseid}/{cmid}
   */
  async getStudyNote(userId: number, courseId: number, cmid: number): Promise<StudyNote> {
    const response = await this.api.get(
      `/webcoach/study-note/${userId}/${courseId}/${cmid}`
    );
    return response.data;
  }

  /**
   * 学習メモ更新
   * PUT /api/webcoach/study-note/{userid}/{courseid}/{cmid}
   */
  async updateStudyNote(
    userId: number,
    courseId: number,
    cmid: number,
    data: UpdateStudyNoteRequest
  ): Promise<StudyNote> {
    const response = await this.api.put(
      `/webcoach/study-note/${userId}/${courseId}/${cmid}`,
      data
    );
    return response.data;
  }

  /**
   * コーチングスケジュール一覧取得
   * GET /api/coaching/schedule/{userid}
   */
  async getCoachingSchedules(userId: number): Promise<CoachingSchedule[]> {
    const response = await this.api.get(`/coaching/schedule/${userId}`);
    return response.data;
  }

  /**
   * コーチングスケジュール作成
   * POST /api/coaching/schedule/{userid}
   */
  async createCoachingSchedule(
    userId: number,
    data: CreateCoachingScheduleRequest
  ): Promise<CoachingSchedule> {
    const response = await this.api.post(`/coaching/schedule/${userId}`, data);
    return response.data;
  }

  /**
   * コーチングスケジュール更新
   * PUT /api/coaching/schedule/{userid}/{id}
   */
  async updateCoachingSchedule(
    userId: number,
    id: number,
    data: UpdateCoachingScheduleRequest
  ): Promise<CoachingSchedule> {
    const response = await this.api.put(`/coaching/schedule/${userId}/${id}`, data);
    return response.data;
  }

  /**
   * コーチングスケジュール削除
   * DELETE /api/coaching/schedule/{userid}/{id}
   */
  async deleteCoachingSchedule(userId: number, id: number): Promise<void> {
    await this.api.delete(`/coaching/schedule/${userId}/${id}`);
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
   * 集中ブース学習セッションの開始/再開(一時停止後)
   * POST /api/study/sessions/{userid}/start
   */
  async startStudySession(userId: number, courseId?: number): Promise<void> {
    await this.api.post(`/study/sessions/${userId}/start`, { courseid: courseId });
  }

  /**
   * 集中ブース学習セッションの一時停止/終了
   * POST /api/study/sessions/{userid}/end
   */
  async endStudySession(userId: number, courseId?: number): Promise<void> {
    await this.api.post(`/study/sessions/${userId}/end`, { courseid: courseId });
  }

  /**
   * 直前に終了した区間の学習時間を手動で補正(低頻度)
   * POST /api/study/sessions/{userid}/correct
   */
  async correctStudySession(userId: number, deltaMinutes: number, courseId?: number): Promise<void> {
    await this.api.post(`/study/sessions/${userId}/correct`, { deltaMinutes, courseid: courseId });
  }

  /**
   * 進行中の学習セッション取得(無ければ404)
   * GET /api/study/sessions/{userid}/active
   */
  async getActiveStudySession(userId: number): Promise<ActiveStudySessionInfo | null> {
    try {
      const response = await this.api.get(`/study/sessions/${userId}/active`);
      return response.data;
    } catch (error: any) {
      if (error?.response?.status === 404) return null;
      throw error;
    }
  }

  /**
   * 直近の学習セッション一覧取得
   * GET /api/study/sessions/{userid}/recent
   */
  async getRecentStudySessions(userId: number, limit = 10): Promise<StudySession[]> {
    const response = await this.api.get(`/study/sessions/${userId}/recent`, { params: { limit } });
    return response.data;
  }

  /**
   * 今日・今週・累計の学習時間取得
   * GET /api/study/stats/{userid}
   */
  async getStudyStats(userId: number): Promise<StudyStats> {
    const response = await this.api.get(`/study/stats/${userId}`);
    return response.data;
  }

  /**
   * 学習ストリーク取得
   * GET /api/study/streak/{userid}
   */
  async getStudyStreak(userId: number): Promise<StudyStreak> {
    const response = await this.api.get(`/study/streak/${userId}`);
    return response.data;
  }

  /**
   * 学習カレンダー取得
   * GET /api/study/calendar/{userid}?year=&month=
   */
  async getStudyCalendar(userId: number, year: number, month: number): Promise<StudyCalendarData> {
    const response = await this.api.get(`/study/calendar/${userId}`, { params: { year, month } });
    return response.data;
  }

  /**
   * 学習時間ランキング取得
   * GET /api/study/ranking?period=&limit=
   */
  async getStudyRanking(period: 'week' | 'month' | 'all' = 'week', limit = 20): Promise<StudyRanking> {
    const response = await this.api.get('/study/ranking', { params: { period, limit } });
    return response.data;
  }

  /**
   * コースごとのアクセス集計取得
   * GET /api/study/course-access/{userid}
   */
  async getCourseAccess(userId: number): Promise<CourseAccess> {
    const response = await this.api.get(`/study/course-access/${userId}`);
    return response.data;
  }

  /**
   * コース内の教材ごとのアクセス集計取得
   * GET /api/study/course-access/{userid}/{courseid}/materials
   */
  async getCourseMaterialAccess(userId: number, courseId: number): Promise<CourseMaterialAccess> {
    const response = await this.api.get(`/study/course-access/${userId}/${courseId}/materials`);
    return response.data;
  }

  /**
   * 教材(page/url/resource)閲覧ログ記録。Moodle標準webserviceのview系関数を発火する。
   * POST /api/study/modules/{userid}/{moduleInstanceId}/viewed
   */
  async logModuleView(
    userId: number,
    moduleType: 'page' | 'url' | 'resource',
    moduleInstanceId: number
  ): Promise<void> {
    await this.api.post(`/study/modules/${userId}/${moduleInstanceId}/viewed`, { moduleType });
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

  // ==================== ミーティング連携 (Zoom / Google Meet) ====================

  /**
   * 自分（コーチ）のミーティング連携状態取得
   * GET /api/integrations/status
   */
  async getMeetingIntegrationStatus(): Promise<{
    coach_user_id: number;
    integrations: Array<{
      coach_user_id: number;
      provider: string;
      provider_account_email: string | null;
      connected_at: string;
      updated_at: string;
    }>;
  }> {
    const response = await this.api.get('/integrations/status');
    return response.data;
  }

  /**
   * Zoom/Google Meet連携の認可URL取得
   * GET /api/integrations/{provider}/authorize
   */
  async getMeetingIntegrationAuthorizeUrl(provider: 'zoom' | 'google'): Promise<{ authorizeUrl: string }> {
    const response = await this.api.get(`/integrations/${provider}/authorize`);
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
}

export const bffClient = new BFFClient();
export default bffClient;
