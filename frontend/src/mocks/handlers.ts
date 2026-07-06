/**
 * MSW モックハンドラ定義
 * ============================================================
 * バックエンド（BFF / FastAPI）は変更できないため、フロントで新機能を作る際に
 * 必要な API はすべてここにモックとして追加する。
 *
 * 【新機能追加の手順】
 *   1. bffClient に新メソッドを足す（例: getAnnouncements → GET /api/webcoach/announcements）
 *   2. このファイルに対応するハンドラを1つ追加する（下の「サンプル機能」を参照）
 *   3. npm start で確認 → dev/XX ブランチへ push → プレビューURLで確認
 *
 * 注意:
 *   - パスは baseURL が /api のため実際のリクエストは `${origin}/api/...`。
 *     どのオリジン/サブパスでも一致するよう `*​/api/...` のワイルドカードで書く。
 *   - ここに無いエンドポイントは onUnhandledRequest: 'bypass' で素通し
 *     （ローカルでは実BFFが無いのでネットワークエラーになるだけ）。
 * ============================================================
 */
import { http, HttpResponse } from 'msw';
import type {
  UserInfo,
  Profile,
  Category,
  ResumeCourse,
} from '../types/api';

// ---- 固定モックデータ（型に沿った最小限） ----------------------------------
const MOCK_USER_ID = 2;

const userInfo: UserInfo = {
  cognito: {
    sub: 'mock-sub-0001',
    email: 'mock@webcoach.dev',
    username: 'mock@webcoach.dev',
  },
  moodle: {
    id: MOCK_USER_ID,
    username: 'mock_user',
    fullname: 'モック 太郎',
    email: 'mock@webcoach.dev',
    firstname: 'モック',
    lastname: '太郎',
    profileimageurl: '',
  },
};

const profile: Profile = {
  mdl_user_id: MOCK_USER_ID,
  nick_name: 'モックさん',
  self_intro: 'これはモック環境のプロフィールです。',
  target_job: 'Webデザイナー',
  ideal_career: 'フリーランスで自由に働く',
  today_small_step: '今日はバナーを1つ作る',
  badge_count: 3,
  goal: '3ヶ月で案件を1件獲得する',
  avatar_url: '',
  avatar_id: '',
};

const categories: Category[] = [
  { id: 1, name: 'Webデザイン', description: 'デザインの基礎から実践まで', coursecount: 8 },
  { id: 2, name: 'コーディング', description: 'HTML/CSS/JavaScript', coursecount: 12 },
  { id: 3, name: 'マーケティング', description: 'Web集客の基礎', coursecount: 5 },
];

const resumeCourses: ResumeCourse[] = [
  {
    courseid: 101,
    fullname: 'はじめてのWebデザイン',
    shortname: 'design-101',
    summary: 'デザインの基本原則を学ぶ入門コース',
    progress: 45,
    lastaccess: Math.floor(Date.now() / 1000) - 3600,
    accesscount: 12,
  },
];

const userCourses = [
  {
    id: 101,
    fullname: 'はじめてのWebデザイン',
    displayname: 'はじめてのWebデザイン',
    summary: 'デザインの基本原則を学ぶ入門コース',
    progress: 45,
    categoryname: 'Webデザイン',
  },
  {
    id: 102,
    fullname: 'HTML/CSS基礎',
    displayname: 'HTML/CSS基礎',
    summary: 'Webページを作る第一歩',
    progress: 10,
    categoryname: 'コーディング',
  },
];

// ---- ハンドラ ---------------------------------------------------------------
export const handlers = [
  // ==================== 認証後のブート経路 ====================
  http.get('*/api/user/info', () => HttpResponse.json(userInfo)),

  http.get('*/api/content-token', () =>
    HttpResponse.json({ token: 'mock-content-token', expiresAt: Date.now() + 60 * 60 * 1000 })
  ),

  http.get('*/api/webcoach/profile/:userid', () => HttpResponse.json(profile)),
  http.get('*/api/webcoach/avatars', () => HttpResponse.json([])),

  // ==================== MyPage / ダッシュボード ====================
  http.get('*/api/webcoach/resumecourse/:userid', () => HttpResponse.json(resumeCourses)),
  http.get('*/api/moodle/courses/:userid', () => HttpResponse.json(userCourses)),
  http.get('*/api/moodle/courses', () => HttpResponse.json(userCourses)),
  http.get('*/api/moodle/categories', () => HttpResponse.json(categories)),
  http.get('*/api/webcoach/recomendbadge/:userid', () => HttpResponse.json([])),
  http.get('*/api/webcoach/next-coaching-goals/:userid', () => HttpResponse.json([])),
  http.get('*/api/webcoach/roadmaps', () => HttpResponse.json([])),
  http.get('*/api/moodle/badges', () => HttpResponse.json([])),
  http.get('*/api/moodle/user-badges/:userid', () => HttpResponse.json([])),
  http.get('*/api/webcoach/ai-applications', () => HttpResponse.json([])),
  http.get('*/api/moodle/notifications/new-content', () =>
    HttpResponse.json({ count: 0, items: [] })
  ),
  http.get('*/health', () => HttpResponse.json({ status: 'ok' })),

  // ==================== サンプル機能（新API＝モックの雛形） ====================
  // 実BFFには存在しない新エンドポイント。/announcements ページから利用する。
  // 新機能を足すときは、このブロックをコピーして中身を差し替える。
  http.get('*/api/webcoach/announcements', () =>
    HttpResponse.json([
      {
        id: 1,
        title: 'モック環境へようこそ',
        body: 'この画面は実BFFではなくMSWモックからデータを取得しています。',
        publishedAt: '2026-07-06T00:00:00Z',
      },
      {
        id: 2,
        title: '新機能はモックAPIで作れます',
        body: 'frontend/src/mocks/handlers.ts にハンドラを1つ足すだけ。',
        publishedAt: '2026-07-05T00:00:00Z',
      },
    ])
  ),
];
