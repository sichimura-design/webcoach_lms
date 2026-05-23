'use strict';

/**
 * 04_courses.test.js
 * コース学習フロー詳細の結合テスト
 *
 * テスト対象:
 *   GET  /api/moodle/getcoursebyfield   - フィールドでコース検索
 *   GET  /api/moodle/badges             - バッジ一覧
 *   GET  /api/moodle/user-badges/:userid - ユーザー獲得バッジ
 *   GET  /api/moodle/tags               - タグ一覧
 *   GET  /api/moodle/courses/by-tag/:tagid - タグからコース取得
 *   GET  /api/webcoach/roadmaps         - ロードマップ一覧
 *   GET  /api/webcoach/roadmap/:roadmapid - ロードマップ詳細
 *   GET  /api/webcoach/tags/:categoryid - カテゴリのタグ一覧
 *   GET  /api/notifications/new-content  - 新着コンテンツ通知
 *
 * ビジネスロジック:
 *   - コース進捗計算: completion statuses の state=1,2 を完了とカウント
 *   - normalizeMoodleContent: HTML正規化
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
} = require('./helpers/mockSetup');

const app = require('../../bff-server/index.js');
app.__setServiceToken(MOCK_SERVICE_TOKEN);

// ============================================================
// 共通: JWT + Moodleユーザー検索をモック
// ============================================================
function auth(extraPostMocks = []) {
  mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_USER);
  const queue = [
    { data: [MOCK_MOODLE_USER] }, // requireAuth: core_user_get_users_by_field
    ...extraPostMocks,
  ];
  axios.post.mockImplementation(async () => queue.shift() || { data: {} });
}

// ============================================================
// テストスイート
// ============================================================
describe('04. コース学習フロー詳細', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    app.__setServiceToken(MOCK_SERVICE_TOKEN);
  });

  // ==========================================================
  // コース進捗計算ロジック
  // ==========================================================
  describe('コース進捗計算', () => {
    // TC-04-01: 全アクティビティ完了 → 100%
    test('TC-04-01: 全アクティビティ完了 → progress=100', async () => {
      const userId = MOCK_MOODLE_USER.id;
      const allCompleted = {
        statuses: [
          { cmid: 201, state: 1 }, // 完了
          { cmid: 202, state: 2 }, // 完了(合格)
          { cmid: 203, state: 1 }, // 完了
        ],
      };

      mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_USER);
      axios.post
        .mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] })   // requireAuth
        .mockResolvedValueOnce({ data: [MOCK_MOODLE_COURSES[0]] }) // enrolled courses (1コース)
        .mockResolvedValueOnce({ data: allCompleted });          // completion status

      const res = await request(app)
        .get(`/api/moodle/courses/${userId}`)
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body[0].progress).toBe(100);
    });

    // TC-04-02: アクティビティなし → 0%
    test('TC-04-02: アクティビティなし → progress=0', async () => {
      const userId = MOCK_MOODLE_USER.id;
      const noActivities = { statuses: [] };

      mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_USER);
      axios.post
        .mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] })
        .mockResolvedValueOnce({ data: [MOCK_MOODLE_COURSES[0]] })
        .mockResolvedValueOnce({ data: noActivities });

      const res = await request(app)
        .get(`/api/moodle/courses/${userId}`)
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body[0].progress).toBe(0);
    });

    // TC-04-03: 未登録コースなし → 空配列
    test('TC-04-03: 登録済みコースなし → 空配列を返す', async () => {
      const userId = MOCK_MOODLE_USER.id;

      mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_USER);
      axios.post
        .mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] })
        .mockResolvedValueOnce({ data: [] }); // 未登録

      const res = await request(app)
        .get(`/api/moodle/courses/${userId}`)
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  // ==========================================================
  // コース検索
  // ==========================================================
  describe('コース検索', () => {
    // TC-04-04: カテゴリIDでコース検索
    test('TC-04-04: GET /api/moodle/getcoursebyfield - categoryidでコース検索', async () => {
      auth([{ data: { courses: MOCK_MOODLE_COURSES } }]);

      const res = await request(app)
        .get('/api/moodle/getcoursebyfield?field=category&value=1')
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
    });

    // TC-04-05: field/valueなし → 400 Bad Request
    test('TC-04-05: GET /api/moodle/getcoursebyfield - パラメータなし → 400', async () => {
      auth();

      const res = await request(app)
        .get('/api/moodle/getcoursebyfield')
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
    });
  });

  // ==========================================================
  // バッジ
  // ==========================================================
  describe('バッジ', () => {
    const mockBadgeList = {
      badges: [
        { id: 1, name: 'HTML達人', description: 'HTMLを習得した証' },
        { id: 2, name: 'CSS名人', description: 'CSSを習得した証' },
      ],
    };

    // TC-04-06: バッジ一覧取得
    test('TC-04-06: GET /api/moodle/badges - バッジ一覧取得', async () => {
      auth([{ data: mockBadgeList }]);

      const res = await request(app)
        .get('/api/moodle/badges')
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
    });

    // TC-04-07: ユーザー獲得バッジ取得 (自分のID)
    test('TC-04-07: GET /api/moodle/user-badges/:userid - 自ユーザーのバッジ取得', async () => {
      const userId = MOCK_MOODLE_USER.id;
      const mockUserBadges = {
        badges: [{ id: 1, name: 'HTML達人', dateissued: 1700000000 }],
      };

      auth([{ data: mockUserBadges }]);

      const res = await request(app)
        .get(`/api/moodle/user-badges/${userId}`)
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
    });

    // TC-04-08: 他ユーザーのバッジにアクセス → 403
    test('TC-04-08: GET /api/moodle/user-badges/:userid - 他ユーザー → 403', async () => {
      mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_USER);
      axios.post.mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] });

      const res = await request(app)
        .get('/api/moodle/user-badges/999')
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(403);
    });
  });

  // ==========================================================
  // タグ・タグ別コース
  // ==========================================================
  describe('タグ', () => {
    // TC-04-09: タグ一覧取得
    test('TC-04-09: GET /api/moodle/tags - タグ一覧取得', async () => {
      const mockTags = [
        { id: 1, name: 'HTML', tagcollid: 1 },
        { id: 2, name: 'CSS', tagcollid: 1 },
      ];

      auth([{ data: mockTags }]);

      const res = await request(app)
        .get('/api/moodle/tags')
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
    });

    // TC-04-10: タグからコース取得
    test('TC-04-10: GET /api/moodle/courses/by-tag/:tagid - タグからコース取得', async () => {
      const mockTagCourses = {
        courses: MOCK_MOODLE_COURSES,
        totalcount: 2,
      };

      auth([{ data: mockTagCourses }]);

      const res = await request(app)
        .get('/api/moodle/courses/by-tag/1')
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
    });

    // TC-04-11: カテゴリのタグ一覧 (WebCoach API)
    test('TC-04-11: GET /api/webcoach/tags/:categoryid - カテゴリタグ一覧', async () => {
      const mockCategoryTags = [
        { id: 1, name: 'HTML' },
        { id: 2, name: 'CSS' },
      ];

      auth();
      axios.get.mockResolvedValueOnce({ data: mockCategoryTags });

      const res = await request(app)
        .get('/api/webcoach/tags/1')
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ==========================================================
  // ロードマップ
  // ==========================================================
  describe('ロードマップ', () => {
    const mockRoadmaps = [
      { id: 1, title: 'Webデザイナーへの道', category: 'design', difficulty: 'beginner' },
      { id: 2, title: 'フロントエンド開発者への道', category: 'programming', difficulty: 'intermediate' },
    ];

    // TC-04-12: ロードマップ一覧取得
    test('TC-04-12: GET /api/webcoach/roadmaps - ロードマップ一覧', async () => {
      auth();
      axios.get.mockResolvedValueOnce({ data: mockRoadmaps });

      const res = await request(app)
        .get('/api/webcoach/roadmaps')
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
    });

    // TC-04-13: ロードマップ詳細取得
    test('TC-04-13: GET /api/webcoach/roadmap/:roadmapid - ロードマップ詳細', async () => {
      const mockRoadmapDetail = {
        ...mockRoadmaps[0],
        steps: [
          { order: 1, courseid: 101, coursename: 'Webデザイン入門' },
          { order: 2, courseid: 102, coursename: 'UI/UX基礎' },
        ],
      };

      auth();
      axios.get.mockResolvedValueOnce({ data: mockRoadmapDetail });

      const res = await request(app)
        .get('/api/webcoach/roadmap/1')
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
    });

    // TC-04-14: カテゴリフィルタ付きロードマップ取得
    test('TC-04-14: GET /api/webcoach/roadmaps?category=design - カテゴリフィルタ', async () => {
      auth();
      axios.get.mockResolvedValueOnce({ data: [mockRoadmaps[0]] });

      const res = await request(app)
        .get('/api/webcoach/roadmaps?category=design')
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
      // APIサーバーにcategoryパラメータが渡されたこと
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/rodmaps'),
        expect.objectContaining({
          params: expect.objectContaining({ category: 'design' }),
        })
      );
    });
  });

  // ==========================================================
  // 新着コンテンツ通知
  // ==========================================================
  describe('新着コンテンツ通知', () => {
    // TC-04-15: 新着コンテンツあり
    test('TC-04-15: GET /api/notifications/new-content - 新着あり', async () => {
      const oneHourAgo = Math.floor(Date.now() / 1000) - 3600;
      const recentCourse = {
        id: 103,
        fullname: '新着コース',
        timemodified: Math.floor(Date.now() / 1000) - 60, // 1分前に更新
      };

      auth([{ data: [recentCourse] }]);

      const since = (Date.now() - 30 * 60 * 1000).toString(); // 30分前

      const res = await request(app)
        .get(`/api/notifications/new-content?since=${since}`)
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.count).toBeGreaterThan(0);
      expect(Array.isArray(res.body.items)).toBe(true);
    });

    // TC-04-16: 新着コンテンツなし
    test('TC-04-16: GET /api/notifications/new-content - 新着なし', async () => {
      const oldCourse = {
        id: 101,
        fullname: '古いコース',
        timemodified: Math.floor(Date.now() / 1000) - 7200, // 2時間前
      };

      auth([{ data: [oldCourse] }]);

      const since = (Date.now() - 60 * 60 * 1000).toString(); // 1時間前

      const res = await request(app)
        .get(`/api/notifications/new-content?since=${since}`)
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
      expect(res.body.items).toEqual([]);
    });
  });

  // ==========================================================
  // コースコンテンツ正規化 (normalizeMoodleContent)
  // ==========================================================
  describe('コースコンテンツ正規化', () => {
    // TC-04-17: Moodle HTMLのstyle内ノイズが正規化される
    test('TC-04-17: pageモジュールのHTMLが正規化されてcontentに設定される', async () => {
      const dirtyHtml = '<p><br></p><p>本文テキスト</p>';
      const mockContentsWithPage = [
        {
          id: 1,
          name: 'セクション1',
          modules: [{ id: 201, name: 'ページ1', modname: 'page' }],
        },
      ];
      const mockPageDetails = {
        pages: [
          {
            coursemodule: 201,
            intro: '',
            introformat: 1,
            content: dirtyHtml,
            contentformat: 1,
            timemodified: Math.floor(Date.now() / 1000),
          },
        ],
      };

      auth([
        { data: mockContentsWithPage },  // core_course_get_contents
        { data: mockPageDetails },       // mod_page_get_pages_by_courses
      ]);

      const res = await request(app)
        .get('/api/moodle/courses/101/contents')
        .set('Authorization', MOCK_USER_TOKEN);

      expect(res.status).toBe(200);
      const pageModule = res.body[0].modules[0];
      expect(pageModule.content).toBeDefined();
      // 先頭の空<p>が除去されていること
      expect(pageModule.content).not.toMatch(/^<p><br><\/p>/);
      expect(pageModule.content).toContain('本文テキスト');
    });
  });
});
