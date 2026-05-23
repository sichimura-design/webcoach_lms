'use strict';

/**
 * 02_auth.test.js
 * 認証・認可ミドルウェアの結合テスト
 *
 * テスト対象:
 *   requireAuth   - JWT検証 + Moodleユーザーマッピング
 *   requireOwnership - ユーザー所有権チェック
 *   requireAdmin  - 管理者グループチェック
 *
 * テストケース一覧:
 *   TC-02-01: Authorizationヘッダーなし → 401
 *   TC-02-02: 無効なJWTトークン → 401
 *   TC-02-03: 有効なJWT・Moodleユーザー存在 → 200
 *   TC-02-04: 有効なJWT・Moodleユーザー未存在 → 自動作成
 *   TC-02-05: 有効なJWT・MoodleメールアドレスとCognito不一致 → Moodle側を更新
 *   TC-02-06: 他ユーザーのリソースにアクセス → 403
 *   TC-02-07: 非管理者が管理者エンドポイントにアクセス → 403
 *   TC-02-08: 管理者グループ所属ユーザーが管理者エンドポイントにアクセス → 200
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
// テストスイート
// ============================================================
describe('02. 認証・認可', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    app.__setServiceToken(MOCK_SERVICE_TOKEN);
  });

  // ----------------------------------------------------------
  // TC-02-01: Authorizationヘッダーなし → 401
  // ----------------------------------------------------------
  test('TC-02-01: Authorizationヘッダーなし → 401 Unauthorized', async () => {
    const res = await request(app)
      .get('/api/user/info');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(res.body.message).toContain('認証が必要です');
  });

  // ----------------------------------------------------------
  // TC-02-02: Bearer形式でない → 401
  // ----------------------------------------------------------
  test('TC-02-02: Bearer形式でないトークン → 401 Unauthorized', async () => {
    const res = await request(app)
      .get('/api/user/info')
      .set('Authorization', 'Basic invalidtoken');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  // ----------------------------------------------------------
  // TC-02-03: 無効なJWTトークン → 401
  // ----------------------------------------------------------
  test('TC-02-03: 無効なJWTトークン → 401 Unauthorized', async () => {
    mockVerify.mockRejectedValueOnce(new Error('jwt expired'));

    const res = await request(app)
      .get('/api/user/info')
      .set('Authorization', 'Bearer invalid.jwt.token');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(res.body.message).toContain('トークンが無効');
  });

  // ----------------------------------------------------------
  // TC-02-04: 有効なJWT・Moodleユーザー存在 → ユーザー情報返却
  // ----------------------------------------------------------
  test('TC-02-04: 有効なJWT・既存Moodleユーザー → 200 ユーザー情報返却', async () => {
    // JWT検証成功
    mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_USER);

    // requireAuth内: Moodleユーザー検索 (idnumberで検索)
    axios.post.mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] });
    // /api/user/info内: Moodleユーザー情報取得 (idで検索)
    axios.post.mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] });

    const res = await request(app)
      .get('/api/user/info')
      .set('Authorization', MOCK_USER_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.cognito.sub).toBe(MOCK_COGNITO_PAYLOAD_USER.sub);
    expect(res.body.cognito.email).toBe(MOCK_COGNITO_PAYLOAD_USER.email);
    expect(res.body.moodle.id).toBe(MOCK_MOODLE_USER.id);
    expect(res.body.moodle.fullname).toBe(MOCK_MOODLE_USER.fullname);
  });

  // ----------------------------------------------------------
  // TC-02-05: 有効なJWT・Moodleユーザー未存在 → 自動作成
  // ----------------------------------------------------------
  test('TC-02-05: Moodleユーザー未存在 → 自動作成されてリクエスト続行', async () => {
    const newCognitoUser = {
      ...MOCK_COGNITO_PAYLOAD_USER,
      sub: 'new-cognito-sub-999',
      email: 'newuser@test.com',
    };

    // JWT検証成功
    mockVerify.mockResolvedValueOnce(newCognitoUser);

    // requireAuth内: Moodleユーザー検索 → 未存在
    axios.post.mockResolvedValueOnce({ data: [] });
    // 自動作成
    axios.post.mockResolvedValueOnce({
      data: [{ id: 99, username: 'newuser' }],
    });
    // /api/user/info内: ユーザー情報取得
    axios.post.mockResolvedValueOnce({
      data: [{ ...MOCK_MOODLE_USER, id: 99, username: 'newuser', idnumber: 'new-cognito-sub-999' }],
    });

    const res = await request(app)
      .get('/api/user/info')
      .set('Authorization', MOCK_USER_TOKEN);

    expect(res.status).toBe(200);
    expect(res.body.moodle.id).toBe(99);
    expect(res.body.moodle.username).toBe('newuser');
  });

  // ----------------------------------------------------------
  // TC-02-06: Moodleメールアドレスが変更された → Moodle側を同期更新
  // ----------------------------------------------------------
  test('TC-02-06: CognitoとMoodleのメールアドレス不一致 → Moodle側を自動更新', async () => {
    const cognitoWithNewEmail = {
      ...MOCK_COGNITO_PAYLOAD_USER,
      email: 'newemail@test.com', // Cognito側で変更済み
    };

    mockVerify.mockResolvedValueOnce(cognitoWithNewEmail);

    // requireAuth内: Moodleユーザー検索 → 旧メール
    axios.post.mockResolvedValueOnce({
      data: [{ ...MOCK_MOODLE_USER, email: 'oldemail@test.com' }],
    });
    // メール更新API呼び出し
    axios.post.mockResolvedValueOnce({ data: null });
    // /api/user/info内: ユーザー情報取得
    axios.post.mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] });

    const res = await request(app)
      .get('/api/user/info')
      .set('Authorization', MOCK_USER_TOKEN);

    expect(res.status).toBe(200);
    // メール更新のAPIが呼ばれたこと (3回のpost呼び出し)
    expect(axios.post).toHaveBeenCalledTimes(3);
  });

  // ----------------------------------------------------------
  // TC-02-07: 他ユーザーのリソースにアクセス → 403 Forbidden
  // ----------------------------------------------------------
  test('TC-02-07: 他ユーザーのリソースにアクセス → 403 Forbidden', async () => {
    mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_USER);
    // Moodleユーザー検索 → 自分のIDは42
    axios.post.mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] });

    // userid=999 (他ユーザー) にアクセスを試みる
    const res = await request(app)
      .get('/api/moodle/courses/999')
      .set('Authorization', MOCK_USER_TOKEN);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('own data');
  });

  // ----------------------------------------------------------
  // TC-02-08: 非管理者が管理者エンドポイントにアクセス → 403
  // ----------------------------------------------------------
  test('TC-02-08: 非管理者が管理者エンドポイントにアクセス → 403 Forbidden', async () => {
    // 一般ユーザー (adminグループなし)
    mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_USER);
    axios.post.mockResolvedValueOnce({ data: [MOCK_MOODLE_USER] });

    const res = await request(app)
      .post('/api/moodle/create-course')
      .set('Authorization', MOCK_USER_TOKEN)
      .send({ courses: [{ fullname: 'Test', shortname: 'test', categoryid: 1 }] });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('管理者権限が必要');
  });

  // ----------------------------------------------------------
  // TC-02-09: 管理者ユーザーが管理者エンドポイントにアクセス → 成功
  // ----------------------------------------------------------
  test('TC-02-09: 管理者ユーザーが管理者エンドポイントにアクセス → 200', async () => {
    // 管理者ユーザー (adminグループあり)
    mockVerify.mockResolvedValueOnce(MOCK_COGNITO_PAYLOAD_ADMIN);
    // requireAuth内: Moodleユーザー検索
    axios.post.mockResolvedValueOnce({ data: [MOCK_MOODLE_ADMIN] });
    // コース作成APIレスポンス
    axios.post.mockResolvedValueOnce({
      data: [{ id: 201, shortname: 'test-course' }],
    });

    const res = await request(app)
      .post('/api/moodle/create-course')
      .set('Authorization', MOCK_ADMIN_TOKEN)
      .send({
        courses: [{ fullname: 'テストコース', shortname: 'test-course', categoryid: 1 }],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
