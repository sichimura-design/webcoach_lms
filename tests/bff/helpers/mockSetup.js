'use strict';

// ============================================================
// テスト用共通モックデータ・セットアップヘルパー
// ============================================================

// テスト用JWTトークン（実際には検証されない）
const MOCK_USER_TOKEN = 'Bearer mock-user-jwt-token';
const MOCK_ADMIN_TOKEN = 'Bearer mock-admin-jwt-token';
const MOCK_SERVICE_TOKEN = 'mock-service-account-token';

// Cognito JWTペイロード: 一般ユーザー
const MOCK_COGNITO_PAYLOAD_USER = {
  sub: 'cognito-sub-user-123',
  email: 'user@test.com',
  'cognito:username': 'testuser',
  'cognito:groups': [],
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
};

// Cognito JWTペイロード: 管理者
const MOCK_COGNITO_PAYLOAD_ADMIN = {
  sub: 'cognito-sub-admin-456',
  email: 'admin@test.com',
  'cognito:username': 'adminuser',
  'cognito:groups': ['admin'],
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
};

// Moodle ユーザー: 一般ユーザー (requireAuth内でマッピングされる)
const MOCK_MOODLE_USER = {
  id: 42,
  username: 'testuser',
  email: 'user@test.com',
  fullname: 'テスト ユーザー',
  firstname: 'テスト',
  lastname: 'ユーザー',
  idnumber: 'cognito-sub-user-123',
  profileimageurl: 'https://moodle.test/user/pix.php/42/f1.jpg',
};

// Moodle ユーザー: 管理者
const MOCK_MOODLE_ADMIN = {
  id: 10,
  username: 'adminuser',
  email: 'admin@test.com',
  fullname: '管理者 ユーザー',
  firstname: '管理者',
  lastname: 'ユーザー',
  idnumber: 'cognito-sub-admin-456',
  profileimageurl: 'https://moodle.test/user/pix.php/10/f1.jpg',
};

// Moodle コース一覧
const MOCK_MOODLE_COURSES = [
  {
    id: 101,
    fullname: 'Webデザイン入門',
    shortname: 'web-intro',
    categoryid: 1,
    summary: 'Webデザインの基礎を学ぶコースです',
    visible: 1,
    timemodified: Math.floor(Date.now() / 1000) - 3600,
  },
  {
    id: 102,
    fullname: 'JavaScript基礎',
    shortname: 'js-basics',
    categoryid: 1,
    summary: 'JavaScriptの基礎を学ぶコースです',
    visible: 1,
    timemodified: Math.floor(Date.now() / 1000) - 7200,
  },
];

// Moodle カテゴリ一覧
const MOCK_MOODLE_CATEGORIES = [
  { id: 1, name: 'Webデザイン', parent: 0, coursecount: 5 },
  { id: 2, name: 'プログラミング', parent: 0, coursecount: 3 },
];

// Moodle コースコンテンツ
const MOCK_COURSE_CONTENTS = [
  {
    id: 1,
    name: '第1章: 基礎',
    modules: [
      {
        id: 201,
        name: 'はじめに',
        modname: 'page',
        content: '<h1>はじめに</h1><p>このコースへようこそ。</p>',
      },
      {
        id: 202,
        name: '参考リンク',
        modname: 'url',
        url: 'https://example.com',
      },
    ],
  },
];

// Moodle アクティビティ完了状態
const MOCK_COMPLETION_STATUS = {
  statuses: [
    { cmid: 201, state: 1 }, // 完了
    { cmid: 202, state: 0 }, // 未完了
  ],
};

// APIサーバー プロフィールレスポンス
const MOCK_PROFILE = {
  userid: 42,
  goal: 'Webデザイナーになる',
  monthly_target: '週3回学習',
  career_path: 'フロントエンドエンジニア',
};

// APIサーバー 再開コースレスポンス
const MOCK_RESUME_COURSES = [
  { courseid: 101, coursename: 'Webデザイン入門', last_accessed: '2026-03-01' },
];

// APIサーバー AIアプリ一覧
const MOCK_AI_APPS = [
  { id: 1, name: '自己PR作成くん', category: 'career', url: 'https://ai1.example.com' },
  { id: 2, name: 'コード修正AI', category: 'programming', url: 'https://ai2.example.com' },
];

// ============================================================
// Moodle APIレスポンスキュー管理
// ============================================================

// axiosモックに返させるレスポンスキュー
// 各テストで必要なMoodle APIレスポンスを push する
let moodleResponseQueue = [];

function resetMoodleResponseQueue() {
  moodleResponseQueue = [];
}

function enqueueMoodleResponse(data) {
  moodleResponseQueue.push({ data });
}

// requireAuth内のMoodleユーザー検索用レスポンスをセットアップ
function setupUserAuthMock(mockAxios, moodleUser = MOCK_MOODLE_USER) {
  // 一般ユーザーのMoodleマッピング用
  mockAxios.post.mockImplementation(async (url, formData) => {
    if (url && url.includes('/webservice/rest/server.php')) {
      const response = moodleResponseQueue.shift();
      if (response) return response;
      // デフォルト: ユーザー検索レスポンス
      return { data: [moodleUser] };
    }
    return { data: {} };
  });
}

// requireAuth内のMoodleユーザー検索 + 追加APIコール用レスポンスをセットアップ
function setupAdminAuthMock(mockAxios, moodleUser = MOCK_MOODLE_ADMIN) {
  mockAxios.post.mockImplementation(async (url, formData) => {
    if (url && url.includes('/webservice/rest/server.php')) {
      const response = moodleResponseQueue.shift();
      if (response) return response;
      return { data: [moodleUser] };
    }
    return { data: {} };
  });
}

module.exports = {
  MOCK_USER_TOKEN,
  MOCK_ADMIN_TOKEN,
  MOCK_SERVICE_TOKEN,
  MOCK_COGNITO_PAYLOAD_USER,
  MOCK_COGNITO_PAYLOAD_ADMIN,
  MOCK_MOODLE_USER,
  MOCK_MOODLE_ADMIN,
  MOCK_MOODLE_COURSES,
  MOCK_MOODLE_CATEGORIES,
  MOCK_COURSE_CONTENTS,
  MOCK_COMPLETION_STATUS,
  MOCK_PROFILE,
  MOCK_RESUME_COURSES,
  MOCK_AI_APPS,
  moodleResponseQueue,
  resetMoodleResponseQueue,
  enqueueMoodleResponse,
  setupUserAuthMock,
  setupAdminAuthMock,
};
