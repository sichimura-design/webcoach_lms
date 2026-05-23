'use strict';

/**
 * 03_user.test.js
 * ユーザーフロー（学習者）の結合テスト
 *
 * テスト対象:
 *   GET  /api/user/info                    - ユーザー情報取得
 *   GET  /api/moodle/categories            - カテゴリ一覧
 *   GET  /api/moodle/courses               - 全コース一覧
 *   GET  /api/moodle/courses/:userid       - 登録済みコース（progress付き）
 *   GET  /api/moodle/courses/:courseid/contents - コースコンテンツ
 *   POST /api/moodle/enroll-course/:courseid    - コース自己登録
 *   GET  /api/webcoach/profile/:userid     - プロフィール取得
 *   POST /api/webcoach/profile/:userid     - プロフィール更新
 *   GET  /api/webcoach/resumecourse/:userid - 再開コース
 *   GET  /api/webcoach/recomendbadge/:userid - おすすめバッジ
 *   GET  /api/webcoach/ai-applications     - AIアプリ一覧
 *   GET  /api/content-token               - CloudFrontコンテンツトークン
 */

// ============================================================
// モック設定
// ============================================================
const mockVerify = jest.fn();

jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: () => ({ verify: mockVerify }),
  },
}));

jest.mock('axios');
jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn(() => ({ send: jest.fn() })),
  AdminCreateUserCommand: jest.fn(),
  AdminAddUserToGroupCommand: jest.fn(),
  ListUsersCommand: jest.fn(),
}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: jest.fn() })),
  PutObjectCommand: jest.fn(),
}));

// ============================================================
// 環境変数設定
// ============================================================
process.env.MOODLE_URL = 'http://moodle.test';
process.env.API_SERVER_URL = 'http://api.test';
process.env.MOODLE_SERVICE_USERNAME = 'service_account';
process.env.MOODLE_SERVICE_PASSWORD = 'service_password';
process.env.SESSION_SECRET = 'test-secret-for-testing-only';
process.env.COGNITO_USER_POOL_ID = 'ap-northeast-1_testpool';
process.env.COGNITO_CLIENT_ID = 'test-client-id';
process.env.S3_BUCKET_NAME = 'test-bucket';
process.env.CLOUDFRONT_DOMAIN = 'test.cloudfront.net';
process.env.CONTENT_TOKEN_SECRET = 'test-content-secret';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const axios = require('axios');
const {
  MOCK_USER_TOKEN,
  MOCK_SERVICE_TOKEN,
  MOCK_COGNITO_PAYLOAD_USER,
  MOCK_MOODLE_USER,
  MOCK_MOODLE_COURSES,
  MOCK_MOODLE_CATEGORIES,
  MOCK_COURSE_CONTENTS,
  MOCK_COMPLETION_STATUS,
  MOCK_PROFILE,
  MOCK_RESUME_COURSES,
  MOCK_AI_APPS,
} = require('./helpers/mockSetup');

const app = require('../../bff-server/index.js');
app.__setServiceToken(MOCK_SERVICE_TOKEN);

// ============================================================
// 共通セットアップ: requireAuth を通過させるモック
// ============================================================
function setupAuthMock(extraPostResponses = []) {
  // JWT検証成功
  mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_USER);

  // 各post呼び出しをキューで管理
  const responses = [
    { data: [MOCK_MOODLE_USER] }, // requireAuth: Moodleユーザー検索
    ...extraPostResponses,
  ];

  axios.post.mockImplementation(async () => {
    return responses.shift() || { data: {} };
  });
}

// ============================================================
// テストスイート
// ============================================================
describe('03. ユーザーフロー（学習者）', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    app.__setServiceToken(MOCK_SERVICE_TOKEN);
  });

  // ==========================================================
  // ユーザー情報
  // ==========================================================
  describe('ユーザー情報', () => {
    // TC-03-01: ユーザー情報取得 (正常系)
    test('TC-03-01: GET /api/user/info - ユーザー情報取得成功', async () => {
      mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_USER);
      axios.post
        .mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] }) // requireAuth: ユーザー検索
        .mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] }); // /api/user/info: ユーザー情報

      const res = await request(app)
        .get('/api/user/info')
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        cognito: {
          sub: MOCK_COGNITO_PAYLOAD_USER.sub,
          email: MOCK_COGNITO_PAYLOAD_USER.email,
          username: MOCK_COGNITO_PAYLOAD_USER['cognito:username'],
        },
        moodle: {
          id: MOCK_MOODLE_USER.id,
          username: MOCK_MOODLE_USER.username,
          fullname: MOCK_MOODLE_USER.fullname,
          email: MOCK_MOODLE_USER.email,
        },
      });
    });

    // TC-03-02: ContentToken 取得
    test('TC-03-02: GET /api/content-token - CloudFrontトークン発行', async () => {
      mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_USER);
      axios.post.mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] });

      const res = await request(app)
        .get('/api/content-token')
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(typeof res.body.token).toBe('string');
      expect(res.body.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  // ==========================================================
  // コース関連
  // ==========================================================
  describe('コース一覧・詳細', () => {
    // TC-03-03: カテゴリ一覧取得
    test('TC-03-03: GET /api/moodle/categories - カテゴリ一覧取得', async () => {
      setupAuthMock([{ data: MOCK_MOODLE_CATEGORIES }]);

      const res = await request(app)
        .get('/api/moodle/categories')
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Webデザイン');
    });

    // TC-03-04: 全コース一覧取得
    test('TC-03-04: GET /api/moodle/courses - 全コース一覧取得', async () => {
      setupAuthMock([{ data: MOCK_MOODLE_COURSES }]);

      const res = await request(app)
        .get('/api/moodle/courses')
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].fullname).toBe('Webデザイン入門');
    });

    // TC-03-05: 登録済みコース一覧 (progress付き)
    test('TC-03-05: GET /api/moodle/courses/:userid - 登録済みコース一覧（progress付き）', async () => {
      const userId = MOCK_MOODLE_USER.id; // 42

      mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_USER);
      axios.post
        .mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] }) // requireAuth
        .mockResolvedValueOnce({ data: MOCK_MOODLE_COURSES }) // enrol_get_users_courses
        // コースごとのprogress計算 (completion API × 2コース)
        .mockResolvedValueOnce({ data: MOCK_COMPLETION_STATUS })
        .mockResolvedValueOnce({ data: MOCK_COMPLETION_STATUS });

      const res = await request(app)
        .get(`/api/moodle/courses/${userId}`)
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty('progress');
      // 2/2 = 100% (state=1が1つ、state=0が1つ → 1/2 = 50%)
      expect(res.body[0].progress).toBe(50);
    });

    // TC-03-06: 他ユーザーの登録コースにアクセス → 403
    test('TC-03-06: 他ユーザーの登録コースにアクセス → 403 Forbidden', async () => {
      mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_USER);
      axios.post.mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] }); // self userId=42

      const res = await request(app)
        .get('/api/moodle/courses/999') // 他ユーザーのID
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(403);
    });

    // TC-03-07: コースコンテンツ取得 (pageモジュール詳細付き)
    test('TC-03-07: GET /api/moodle/courses/:courseid/contents - コースコンテンツ取得', async () => {
      const mockPageDetails = {
        pages: [
          {
            coursemodule: 201,
            intro: '<p>はじめに</p>',
            introformat: 1,
            content: '<h1>本文</h1><p>テキスト</p>',
            contentformat: 1,
            timemodified: Math.floor(Date.now() / 1000),
          },
        ],
      };

      setupAuthMock([
        { data: MOCK_COURSE_CONTENTS },  // core_course_get_contents
        { data: mockPageDetails },       // mod_page_get_pages_by_courses
      ]);

      const res = await request(app)
        .get('/api/moodle/courses/101/contents')
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].modules[0].modname).toBe('page');
      // pageモジュールにはcontentが付与されていること
      expect(res.body[0].modules[0].content).toBeDefined();
    });
  });

  // ==========================================================
  // コース登録
  // ==========================================================
  describe('コース登録', () => {
    // TC-03-08: コース自己登録 (正常系)
    test('TC-03-08: POST /api/moodle/enroll-course/:courseid - コース登録成功', async () => {
      setupAuthMock([
        { data: null }, // enrol_manual_enrol_users レスポンス
      ]);

      const res = await request(app)
        .post('/api/moodle/enroll-course/101')
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.courseid).toBe(101);
      expect(res.body.userid).toBe(MOCK_MOODLE_USER.id);
      expect(res.body.message).toContain('登録');
    });

    // TC-03-09: 認証なしでのコース登録 → 401
    test('TC-03-09: 認証なしでのコース登録 → 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/moodle/enroll-course/101');

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================
  // マイページ・プロフィール
  // ==========================================================
  describe('マイページ・プロフィール', () => {
    // TC-03-10: プロフィール取得 (正常系)
    test('TC-03-10: GET /api/webcoach/profile/:userid - プロフィール取得', async () => {
      const userId = MOCK_MOODLE_USER.id;
      mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_USER);
      axios.post.mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] }); // requireAuth
      axios.get.mockResolvedValueOnce({ data: MOCK_PROFILE }); // API Server

      const res = await request(app)
        .get(`/api/webcoach/profile/${userId}`)
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.userid).toBe(userId);
      expect(res.body.goal).toBeDefined();
    });

    // TC-03-11: 他ユーザーのプロフィールにアクセス → 403
    test('TC-03-11: 他ユーザーのプロフィールにアクセス → 403 Forbidden', async () => {
      mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_USER);
      axios.post.mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] }); // self userId=42

      const res = await request(app)
        .get('/api/webcoach/profile/999')
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(403);
    });

    // TC-03-12: プロフィール更新 (正常系)
    test('TC-03-12: POST /api/webcoach/profile/:userid - プロフィール更新', async () => {
      const userId = MOCK_MOODLE_USER.id;
      const updateData = { goal: '新しい目標', monthly_target: '週5回' };

      mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_USER);
      axios.post.mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] }); // requireAuth
      axios.post.mockResolvedValueOnce({ data: { ...MOCK_PROFILE, ...updateData } }); // API Server

      const res = await request(app)
        .post(`/api/webcoach/profile/${userId}`)
        .set('Authorization', MOCK_USER_TOKEN)
        .send(updateData);

      expect(res.status).toBe(200);
    });

    // TC-03-13: 再開コース取得 (progress付き)
    test('TC-03-13: GET /api/webcoach/resumecourse/:userid - 再開コース取得', async () => {
      const userId = MOCK_MOODLE_USER.id;
      mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_USER);
      axios.post
        .mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] }) // requireAuth
        // resumecourse内でcalculateCourseProgressが呼ばれる
        .mockResolvedValueOnce({ data: MOCK_COMPLETION_STATUS }); // completion API

      axios.get.mockResolvedValueOnce({ data: MOCK_RESUME_COURSES }); // API Server

      const res = await request(app)
        .get(`/api/webcoach/resumecourse/${userId}`)
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0]).toHaveProperty('progress');
    });

    // TC-03-14: おすすめバッジ取得
    test('TC-03-14: GET /api/webcoach/recomendbadge/:userid - おすすめバッジ取得', async () => {
      const userId = MOCK_MOODLE_USER.id;
      const mockBadges = [
        { id: 1, name: 'HTML達人', courseid: 101 },
        { id: 2, name: 'CSS名人', courseid: 102 },
      ];

      mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_USER);
      axios.post.mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] });
      axios.get.mockResolvedValueOnce({ data: mockBadges });

      const res = await request(app)
        .get(`/api/webcoach/recomendbadge/${userId}`)
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].name).toBe('HTML達人');
    });
  });

  // ==========================================================
  // AIアプリ
  // ==========================================================
  describe('AIアプリ', () => {
    // TC-03-15: AIアプリ一覧取得
    test('TC-03-15: GET /api/webcoach/ai-applications - AIアプリ一覧取得', async () => {
      setupAuthMock();
      axios.get.mockResolvedValueOnce({ data: MOCK_AI_APPS });

      const res = await request(app)
        .get('/api/webcoach/ai-applications')
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('自己PR作成くん');
    });

    // TC-03-16: AIチャット
    test('TC-03-16: POST /api/webcoach/ai - AIチャット', async () => {
      setupAuthMock();
      const mockAiResponse = { message: 'AIからの回答テキスト', session_id: 'abc123' };
      axios.post.mockResolvedValueOnce({ data: mockAiResponse });

      const res = await request(app)
        .post('/api/webcoach/ai')
        .set('Authorization', MOCK_USER_TOKEN)
        .send({ message: 'こんにちは', application_id: 1 });

      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();
    });
  });

  // ==========================================================
  // エラーハンドリング
  // ==========================================================
  describe('エラーハンドリング', () => {
    // TC-03-17: Moodle API エラー → 500
    test('TC-03-17: Moodle APIがエラーを返す → 500 Internal Server Error', async () => {
      mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_USER);
      axios.post
        .mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] }) // requireAuth
        .mockRejectedValueOnce(new Error('Moodle API timeout')); // categories API

      const res = await request(app)
        .get('/api/moodle/categories')
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();
    });

    // TC-03-18: APIサーバーエラー → 500
    test('TC-03-18: APIサーバーがエラーを返す → 500 Internal Server Error', async () => {
      const userId = MOCK_MOODLE_USER.id;
      mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_USER);
      axios.post.mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] });
      axios.get.mockRejectedValueOnce(new Error('API Server down'));

      const res = await request(app)
        .get(`/api/webcoach/profile/${userId}`)
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(500);
    });

    // TC-03-19: 存在しないエンドポイント → 404
    test('TC-03-19: 存在しないエンドポイント → 404 Not Found', async () => {
      const res = await request(app).get('/api/nonexistent-endpoint');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
    });
  });
});
