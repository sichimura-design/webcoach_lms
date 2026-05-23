'use strict';

/**
 * 05_admin.test.js
 * 管理者フローの結合テスト
 *
 * テスト対象:
 *   POST /api/moodle/create-course       - コース一括作成
 *   POST /api/moodle/create-category     - カテゴリ一括作成
 *   POST /api/admin/cognito-users        - Cognitoユーザー一括作成
 *   GET  /api/admin/cognito-users        - Cognitoユーザー一覧
 *   POST /api/admin/s3-upload            - S3ファイルアップロード
 *   POST /api/webcoach/updatedb          - WebCoachデータ一括更新
 *
 * 認可要件:
 *   - 全エンドポイントで requireAuth + requireAdmin が必要
 *   - 一般ユーザー (adminグループ非所属) → 403
 *   - 管理者ユーザー (adminグループ所属) → 処理実行
 */

// ============================================================
// モック設定
// ============================================================
const mockVerify = jest.fn();
const mockCognitoSend = jest.fn();
const mockS3Send = jest.fn();

jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: () => ({ verify: mockVerify }),
  },
}));

jest.mock('axios');
jest.mock('@aws-sdk/client-cognito-identity-provider', () => ({
  CognitoIdentityProviderClient: jest.fn(() => ({ send: mockCognitoSend })),
  AdminCreateUserCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'AdminCreateUser' })),
  AdminAddUserToGroupCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'AdminAddUserToGroup' })),
  ListUsersCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'ListUsers' })),
}));
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send: mockS3Send })),
  PutObjectCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'PutObject' })),
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
  MOCK_ADMIN_TOKEN,
  MOCK_SERVICE_TOKEN,
  MOCK_COGNITO_PAYLOAD_USER,
  MOCK_COGNITO_PAYLOAD_ADMIN,
  MOCK_MOODLE_USER,
  MOCK_MOODLE_ADMIN,
} = require('./helpers/mockSetup');

const app = require('../../bff-server/index.js');
app.__setServiceToken(MOCK_SERVICE_TOKEN);

// ============================================================
// 共通: 管理者認証モック
// ============================================================
function adminAuth(extraPostMocks = []) {
  mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_ADMIN);
  const queue = [
    { data: [MOCK_MOODLE_ADMIN] }, // requireAuth: Moodleユーザー検索
    ...extraPostMocks,
  ];
  axios.post.mockImplementation(async () => queue.shift() || { data: {} });
}

function userAuth() {
  mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_USER);
  axios.post.mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] });
}

// ============================================================
// テストスイート
// ============================================================
describe('05. 管理者フロー', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    app.__setServiceToken(MOCK_SERVICE_TOKEN);
  });

  // ==========================================================
  // コース作成
  // ==========================================================
  describe('コース作成 (POST /api/moodle/create-course)', () => {
    const validCoursePayload = {
      courses: [
        { fullname: 'Webデザイン入門', shortname: 'web-intro-001', categoryid: 1 },
        { fullname: 'JavaScript基礎', shortname: 'js-basics-001', categoryid: 1 },
      ],
    };

    // TC-05-01: コース一括作成 (正常系)
    test('TC-05-01: 管理者がコース一括作成 → 201/200 Created', async () => {
      const moodleCreatedCourses = [
        { id: 201, shortname: 'web-intro-001' },
        { id: 202, shortname: 'js-basics-001' },
      ];

      adminAuth([{ data: moodleCreatedCourses }]);

      const res = await request(app)
        .post('/api/moodle/create-course')
        .set('Authorization', MOCK_ADMIN_TOKEN)
        .send(validCoursePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.created).toBe(2);
      expect(res.body.courses).toHaveLength(2);
    });

    // TC-05-02: 非管理者がコース作成 → 403
    test('TC-05-02: 非管理者がコース作成 → 403 Forbidden', async () => {
      userAuth();

      const res = await request(app)
        .post('/api/moodle/create-course')
        .set('Authorization', MOCK_USER_TOKEN)
        .send(validCoursePayload);

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('管理者権限');
    });

    // TC-05-03: coursesが配列でない → 400 Bad Request
    test('TC-05-03: coursesが配列でない → 400 Bad Request', async () => {
      adminAuth();

      const res = await request(app)
        .post('/api/moodle/create-course')
        .set('Authorization', MOCK_ADMIN_TOKEN)
        .send({ courses: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.message).toContain('must be an array');
    });

    // TC-05-04: coursesが空配列 → 400 Bad Request
    test('TC-05-04: coursesが空配列 → 400 Bad Request', async () => {
      adminAuth();

      const res = await request(app)
        .post('/api/moodle/create-course')
        .set('Authorization', MOCK_ADMIN_TOKEN)
        .send({ courses: [] });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('cannot be empty');
    });

    // TC-05-05: 必須フィールド不足 → 500
    test('TC-05-05: fullname/shortname/categoryidが不足 → 500 エラー', async () => {
      adminAuth();

      const res = await request(app)
        .post('/api/moodle/create-course')
        .set('Authorization', MOCK_ADMIN_TOKEN)
        .send({
          courses: [
            { fullname: 'テストコース' }, // shortname, categoryid なし
          ],
        });

      expect(res.status).toBe(500);
      expect(res.body.message).toContain('missing required fields');
    });

    // TC-05-06: オプションフィールド付きでコース作成
    test('TC-05-06: オプションフィールド(summary, visible, startdate)付きでコース作成', async () => {
      adminAuth([{ data: [{ id: 201, shortname: 'test-full-001' }] }]);

      const res = await request(app)
        .post('/api/moodle/create-course')
        .set('Authorization', MOCK_ADMIN_TOKEN)
        .send({
          courses: [
            {
              fullname: 'フルオプションコース',
              shortname: 'test-full-001',
              categoryid: 1,
              summary: 'コースの説明文',
              format: 'topics',
              visible: true,
              startdate: Math.floor(Date.now() / 1000),
              enddate: Math.floor(Date.now() / 1000) + 86400 * 90,
            },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================================
  // カテゴリ作成
  // ==========================================================
  describe('カテゴリ作成 (POST /api/moodle/create-category)', () => {
    // TC-05-07: カテゴリ一括作成 (正常系)
    test('TC-05-07: 管理者がカテゴリ一括作成 → 200 Created', async () => {
      const moodleCreatedCategories = [
        { id: 10, name: 'デザイン', parent: 0 },
        { id: 11, name: 'プログラミング', parent: 0 },
      ];

      adminAuth([{ data: moodleCreatedCategories }]);

      const res = await request(app)
        .post('/api/moodle/create-category')
        .set('Authorization', MOCK_ADMIN_TOKEN)
        .send({
          categories: [
            { name: 'デザイン' },
            { name: 'プログラミング', parent: 0 },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.created).toBe(2);
    });

    // TC-05-08: 非管理者がカテゴリ作成 → 403
    test('TC-05-08: 非管理者がカテゴリ作成 → 403 Forbidden', async () => {
      userAuth();

      const res = await request(app)
        .post('/api/moodle/create-category')
        .set('Authorization', MOCK_USER_TOKEN)
        .send({ categories: [{ name: 'テスト' }] });

      expect(res.status).toBe(403);
    });

    // TC-05-09: name未指定 → 500
    test('TC-05-09: categoryのnameフィールド未指定 → 500 エラー', async () => {
      adminAuth();

      const res = await request(app)
        .post('/api/moodle/create-category')
        .set('Authorization', MOCK_ADMIN_TOKEN)
        .send({
          categories: [{ idnumber: 'cat001' }], // name なし
        });

      expect(res.status).toBe(500);
      expect(res.body.message).toContain('name');
    });
  });

  // ==========================================================
  // Cognitoユーザー管理
  // ==========================================================
  describe('Cognitoユーザー管理', () => {
    // TC-05-10: Cognitoユーザー一括作成 (正常系)
    test('TC-05-10: 管理者がCognitoユーザー一括作成 → 200 成功', async () => {
      adminAuth();

      // 重複チェック: ユーザーなし
      mockCognitoSend.mockResolvedValueOnce({ Users: [] }); // ListUsers (既存チェック)
      mockCognitoSend.mockResolvedValueOnce({}); // AdminCreateUser
      mockCognitoSend.mockResolvedValueOnce({ Users: [] }); // ListUsers (2人目)
      mockCognitoSend.mockResolvedValueOnce({}); // AdminCreateUser

      const res = await request(app)
        .post('/api/admin/cognito-users')
        .set('Authorization', MOCK_ADMIN_TOKEN)
        .send({
          records: [
            { email: 'newuser1@test.com', username: 'newuser1' },
            { email: 'newuser2@test.com', username: 'newuser2' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.recordsProcessed).toBe(2);
      expect(res.body.recordsFailed).toBe(0);
    });

    // TC-05-11: メールアドレス重複 → 部分失敗
    test('TC-05-11: メールアドレス重複ユーザーが含まれる → 部分失敗レスポンス', async () => {
      adminAuth();

      // 1人目: 重複あり
      mockCognitoSend.mockResolvedValueOnce({
        Users: [{ Username: 'existinguser', UserStatus: 'CONFIRMED' }],
      });
      // 2人目: 重複なし
      mockCognitoSend.mockResolvedValueOnce({ Users: [] });
      mockCognitoSend.mockResolvedValueOnce({}); // AdminCreateUser

      const res = await request(app)
        .post('/api/admin/cognito-users')
        .set('Authorization', MOCK_ADMIN_TOKEN)
        .send({
          records: [
            { email: 'existing@test.com', username: 'existinguser' },
            { email: 'newuser@test.com', username: 'newuser' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.recordsProcessed).toBe(1);
      expect(res.body.recordsFailed).toBe(1);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toHaveLength(1);
      expect(res.body.errors[0].message).toContain('既に登録');
    });

    // TC-05-12: グループ指定付きユーザー作成
    test('TC-05-12: グループ指定付きCognitoユーザー作成', async () => {
      adminAuth();

      mockCognitoSend.mockResolvedValueOnce({ Users: [] }); // ListUsers
      mockCognitoSend.mockResolvedValueOnce({}); // AdminCreateUser
      mockCognitoSend.mockResolvedValueOnce({}); // AdminAddUserToGroup

      const res = await request(app)
        .post('/api/admin/cognito-users')
        .set('Authorization', MOCK_ADMIN_TOKEN)
        .send({
          records: [{ email: 'teacher@test.com', username: 'teacher1', group: 'Teachers' }],
        });

      expect(res.status).toBe(200);
      expect(res.body.recordsProcessed).toBe(1);
      // AdminAddUserToGroup が呼ばれたこと
      expect(mockCognitoSend).toHaveBeenCalledTimes(3);
    });

    // TC-05-13: email/username未指定 → バリデーションエラー
    test('TC-05-13: email/username未指定のレコード → そのレコードが失敗', async () => {
      adminAuth();

      const res = await request(app)
        .post('/api/admin/cognito-users')
        .set('Authorization', MOCK_ADMIN_TOKEN)
        .send({
          records: [
            { email: 'valid@test.com', username: 'validuser' },
            { username: 'noemail' }, // email なし
          ],
        });

      expect(res.status).toBe(200);
      // emailなしのレコードは失敗扱いになるが、処理は継続される
      // 有効なレコードは処理成功のためCognito APIが呼ばれる
    });

    // TC-05-14: records未指定 → 400 Bad Request
    test('TC-05-14: recordsパラメータなし → 400 Bad Request', async () => {
      adminAuth();

      const res = await request(app)
        .post('/api/admin/cognito-users')
        .set('Authorization', MOCK_ADMIN_TOKEN)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
    });

    // TC-05-15: Cognitoユーザー一覧取得
    test('TC-05-15: GET /api/admin/cognito-users - ユーザー一覧取得', async () => {
      adminAuth();

      const mockCognitoUsers = {
        Users: [
          {
            Username: 'user001',
            UserStatus: 'CONFIRMED',
            Enabled: true,
            UserCreateDate: new Date(),
            Attributes: [
              { Name: 'email', Value: 'user001@test.com' },
            ],
          },
        ],
      };

      mockCognitoSend.mockResolvedValueOnce(mockCognitoUsers);

      const res = await request(app)
        .get('/api/admin/cognito-users')
        .set('Authorization', MOCK_ADMIN_TOKEN);

      expect(res.status).toBe(200);
      expect(res.body.users).toBeDefined();
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.users[0].username).toBe('user001');
      expect(res.body.users[0].email).toBe('user001@test.com');
    });
  });

  // ==========================================================
  // S3ファイルアップロード
  // ==========================================================
  describe('S3ファイルアップロード (POST /api/admin/s3-upload)', () => {
    // TC-05-16: 画像ファイルアップロード (正常系)
    test('TC-05-16: 管理者が画像ファイルをS3にアップロード → 200 成功', async () => {
      adminAuth();
      mockS3Send.mockResolvedValueOnce({ ETag: '"abc123"' });

      const res = await request(app)
        .post('/api/admin/s3-upload')
        .set('Authorization', MOCK_ADMIN_TOKEN)
        .attach('file', Buffer.from('fake image data'), {
          filename: 'test-image.png',
          contentType: 'image/png',
        })
        .field('s3Key', 'course-images/test-image.png');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.s3Key).toBe('course-images/test-image.png');
      expect(res.body.url).toContain('test.cloudfront.net');
      expect(res.body.url).toContain('course-images/test-image.png');
    });

    // TC-05-17: HTMLファイルアップロード
    test('TC-05-17: HTMLファイルをS3のhtml-contentパスにアップロード', async () => {
      adminAuth();
      mockS3Send.mockResolvedValueOnce({ ETag: '"def456"' });

      const htmlContent = '<h1>コースコンテンツ</h1><p>テキスト</p>';

      const res = await request(app)
        .post('/api/admin/s3-upload')
        .set('Authorization', MOCK_ADMIN_TOKEN)
        .attach('file', Buffer.from(htmlContent), {
          filename: 'lesson01.html',
          contentType: 'text/html',
        })
        .field('s3Key', 'html-content/lesson01.html');

      expect(res.status).toBe(200);
      expect(res.body.url).toContain('html-content/lesson01.html');
    });

    // TC-05-18: ファイルなし → 400 Bad Request
    test('TC-05-18: ファイルなしでアップロード → 400 Bad Request', async () => {
      adminAuth();

      const res = await request(app)
        .post('/api/admin/s3-upload')
        .set('Authorization', MOCK_ADMIN_TOKEN)
        .send({ s3Key: 'course-images/test.png' }); // multipartでない

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
    });

    // TC-05-19: s3Key未指定 → 400 Bad Request
    test('TC-05-19: s3Key未指定でアップロード → 400 Bad Request', async () => {
      adminAuth();

      const res = await request(app)
        .post('/api/admin/s3-upload')
        .set('Authorization', MOCK_ADMIN_TOKEN)
        .attach('file', Buffer.from('data'), {
          filename: 'test.png',
          contentType: 'image/png',
        });
      // s3Keyなし

      expect(res.status).toBe(400);
      expect(res.body.detail).toContain('s3Key');
    });

    // TC-05-20: 非管理者がS3アップロード → 403
    test('TC-05-20: 非管理者がS3アップロード → 403 Forbidden', async () => {
      userAuth();

      const res = await request(app)
        .post('/api/admin/s3-upload')
        .set('Authorization', MOCK_USER_TOKEN)
        .attach('file', Buffer.from('data'), {
          filename: 'test.png',
          contentType: 'image/png',
        })
        .field('s3Key', 'course-images/test.png');

      expect(res.status).toBe(403);
    });

    // TC-05-21: S3バケット名未設定 → 500
    test('TC-05-21: S3バケット名未設定 → 500 エラー', async () => {
      const originalBucket = process.env.S3_BUCKET_NAME;
      process.env.S3_BUCKET_NAME = '';

      adminAuth();

      const res = await request(app)
        .post('/api/admin/s3-upload')
        .set('Authorization', MOCK_ADMIN_TOKEN)
        .attach('file', Buffer.from('data'), {
          filename: 'test.png',
          contentType: 'image/png',
        })
        .field('s3Key', 'course-images/test.png');

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('S3_BUCKET_NAME');

      process.env.S3_BUCKET_NAME = originalBucket;
    });
  });

  // ==========================================================
  // WebCoachデータ一括更新
  // ==========================================================
  describe('WebCoachデータ一括更新 (POST /api/webcoach/updatedb)', () => {
    // TC-05-22: AIアプリ情報一括登録
    test('TC-05-22: AIアプリ情報をCSVから一括登録 → 200 成功', async () => {
      adminAuth();

      const mockApiResponse = {
        success: true,
        recordsProcessed: 2,
        recordsFailed: 0,
        message: '2件処理しました',
      };
      axios.post.mockResolvedValueOnce({ data: mockApiResponse });

      const res = await request(app)
        .post('/api/webcoach/updatedb')
        .set('Authorization', MOCK_ADMIN_TOKEN)
        .send({
          data_type: 'ai_applications',
          records: [
            { name: '自己PR作成くん', category: 'career', url: 'https://ai1.example.com' },
            { name: 'コード修正AI', category: 'programming', url: 'https://ai2.example.com' },
          ],
        });

      expect(res.status).toBe(200);
      expect(res.body.recordsProcessed).toBe(2);
    });

    // TC-05-23: data_type未指定 → 400 Bad Request
    test('TC-05-23: data_type未指定 → 400 Bad Request', async () => {
      adminAuth();

      const res = await request(app)
        .post('/api/webcoach/updatedb')
        .set('Authorization', MOCK_ADMIN_TOKEN)
        .send({ records: [{ name: 'test' }] });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Bad Request');
      expect(res.body.detail).toContain('data_type');
    });

    // TC-05-24: recordsが配列でない → 400 Bad Request
    test('TC-05-24: recordsが配列でない → 400 Bad Request', async () => {
      adminAuth();

      const res = await request(app)
        .post('/api/webcoach/updatedb')
        .set('Authorization', MOCK_ADMIN_TOKEN)
        .send({ data_type: 'ai_applications', records: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.detail).toContain('must be an array');
    });
  });
});
