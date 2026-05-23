'use strict';

/**
 * 01_health.test.js
 * ヘルスチェックエンドポイントの結合テスト
 *
 * テスト対象:
 *   GET /health    - 詳細ヘルスチェック（Moodle/APIサーバー接続確認）
 *   GET /api/health - シンプルヘルスチェック（LB用）
 */

// ============================================================
// モック設定 (jest.mock は先頭に書く必要がある)
// ============================================================
jest.mock('aws-jwt-verify', () => ({
  CognitoJwtVerifier: {
    create: () => ({ verify: jest.fn() }),
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
// 環境変数設定 (validateEnvironment() 実行前に必須)
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
const { MOCK_SERVICE_TOKEN } = require('./helpers/mockSetup');

// BFFアプリを require
const app = require('../../bff-server/index.js');
// テスト用にサービスアカウントトークンを設定
app.__setServiceToken(MOCK_SERVICE_TOKEN);

// ============================================================
// テストスイート
// ============================================================
describe('01. ヘルスチェック', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    app.__setServiceToken(MOCK_SERVICE_TOKEN);
  });

  // ----------------------------------------------------------
  // TC-01-01: シンプルヘルスチェック (正常系)
  // ----------------------------------------------------------
  test('TC-01-01: GET /api/health - サービスアカウントトークンあり → 200 ok', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });

  // ----------------------------------------------------------
  // TC-01-02: シンプルヘルスチェック (異常系: トークン未初期化)
  // ----------------------------------------------------------
  test('TC-01-02: GET /api/health - サービスアカウントトークンなし → 503 error', async () => {
    app.__setServiceToken(null);

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('error');
  });

  // ----------------------------------------------------------
  // TC-01-03: 詳細ヘルスチェック - Moodle/APIサーバー共に正常
  // ----------------------------------------------------------
  test('TC-01-03: GET /health - Moodle・APIサーバー接続正常 → 200 ok', async () => {
    // Moodle API (core_webservice_get_site_info) のモック
    axios.post.mockResolvedValueOnce({
      data: { sitename: 'Test Moodle', version: '4.1' },
    });
    // API Server /health のモック
    axios.get.mockResolvedValueOnce({ status: 200, data: { status: 'ok' } });

    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.checks.moodle.status).toBe('ok');
    expect(res.body.checks.apiServer.status).toBe('ok');
    expect(res.body.checks.serviceAccountToken).toBe(true);
  });

  // ----------------------------------------------------------
  // TC-01-04: 詳細ヘルスチェック - Moodle接続エラー
  // ----------------------------------------------------------
  test('TC-01-04: GET /health - Moodle接続エラー → 503 degraded', async () => {
    // Moodle API エラー
    axios.post.mockRejectedValueOnce(new Error('Connection refused'));
    // API Server は正常
    axios.get.mockResolvedValueOnce({ status: 200, data: { status: 'ok' } });

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.moodle.status).toBe('error');
    expect(res.body.checks.moodle.message).toBe('Connection refused');
  });

  // ----------------------------------------------------------
  // TC-01-05: 詳細ヘルスチェック - APIサーバー接続エラー
  // ----------------------------------------------------------
  test('TC-01-05: GET /health - APIサーバー接続エラー → 503 でもMoodleはok', async () => {
    // Moodle は正常
    axios.post.mockResolvedValueOnce({ data: { sitename: 'Test Moodle' } });
    // API Server エラー
    axios.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const res = await request(app).get('/health');

    expect(res.status).toBe(503);
    expect(res.body.checks.moodle.status).toBe('ok');
    expect(res.body.checks.apiServer.status).toBe('error');
  });
});
