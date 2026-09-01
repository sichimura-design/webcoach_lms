import React from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import LoginPage from '../components/LoginPage';
import PasswordResetPage from '../components/PasswordResetPage';
import MyPage from '../components/MyPage';
import StudyLogPage from '../components/studyLog/StudyLogPage';
// CoachingNotesPage(dev/miyabeの招待URL型コーチング連携、モック)はどのルートにも接続していない。
// TODO(backend未実装/方針転換で陳腐化): 下の /coaching ルートのコメント参照。
import LearningPlanPage from '../components/learningPlan/LearningPlanPage';
import LearningPlanSetupPage from '../components/learningPlan/LearningPlanSetupPage';
import ConnectCoachPage from '../components/ConnectCoachPage';
import ProfilePage from '../components/ProfilePage';
import WebCoachDashboard from '../components/WebCoachDashboard';
import CareerPathPage from '../components/CareerPathPage';
import MaterialsTopPage from '../components/MaterialsTopPage';
import AreaCoursesPage from '../components/materials/AreaCoursesPage';
import LearningCoursesPage from '../components/LearningCoursesPage';
import AiCoachPage from '../components/aicoach/AiCoachPage';
import BadgesPage from '../components/BadgesPage';
import ContentListPage from '../components/ContentListPage';
import CourseContentPage from '../components/CourseContentPage';
import CourseTopPage from '../components/CourseTopPage';
import { RoadmapPage } from '../components/RoadmapPage';
// LearningWorkspacePage(dev/miyabeの構造化教材/モック中心UI)は現在どのルートにも
// 接続していない。TODO(教材表示アーキテクチャ未決定): 上のCourseContentWrapperのコメント参照。
import MyNotesPage from '../components/notes/MyNotesPage';
import AccountSettingsPage from '../components/AccountSettingsPage';
import HelpPage from '../components/help/HelpPage';
import AnimatedPage from '../components/AnimatedPage';
import { AdminLayout } from '../components/admin/AdminLayout';
import { AdminCsvPage } from '../components/admin/AdminCsvPage';
import { AdminCognitoUsersPage } from '../components/admin/AdminCognitoUsersPage';
import { AdminImageUploadPage } from '../components/admin/AdminImageUploadPage';
import { AdminVectorPage } from '../components/admin/AdminVectorPage';
import { AdminStudentsPage } from '../components/admin/AdminStudentsPage';
import { AdminCoachMappingPage } from '../components/admin/AdminCoachMappingPage';
import { AdminCoachIntegrationsPage } from '../components/admin/AdminCoachIntegrationsPage';
import { CoachStudentsPage } from '../components/coach/CoachStudentsPage';
import { CoachSettingsPage } from '../components/coach/CoachSettingsPage';
import { CoachingSchedulePage } from '../components/coach/CoachingSchedulePage';
import { MyCoachingPage } from '../components/MyCoachingPage';
import FocusBoothPage from '../components/FocusBoothPage';
import { useAuth } from '../contexts/AuthContext';
import { useAiCoachExpandOriginCleanup } from '../hooks/useAiCoachExpandOriginCleanup';
import { useNavigationStore } from '../store/navigationStore';
import { ErrorBoundary } from '../components/shared';
import { MOCKS_ENABLED } from '../mocks/config';

/**
 * トークン・部品カタログ（/dev/catalog）。UI/UXレビューの「横串」用の比較台で、
 * 受講生には見せない。MOCKS_ENABLED でルート自体を出し分ける。
 * lazy にしているのは、静的 import だとモック無効のビルドでもメインバンドルに
 * 混ざるため。別チャンクに切り出しておけば本番では一度も取得されない。
 */
const DevCatalogPage = React.lazy(() => import('../components/dev/DevCatalogPage'));

interface ProtectedRouteProps {
  children: React.ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <span className="w-8 h-8 border-3 border-[#E86D78] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <AnimatedPage>{children}</AnimatedPage>;
}

function AdminRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <span className="w-8 h-8 border-3 border-[#E86D78] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.isAdmin) {
    return <Navigate to="/mypage" replace />;
  }

  return <AnimatedPage>{children}</AnimatedPage>;
}

function CoachRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
        <span className="w-8 h-8 border-3 border-[#E86D78] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!user.isCoach && !user.isAdmin) {
    return <Navigate to="/mypage" replace />;
  }

  return <AnimatedPage>{children}</AnimatedPage>;
}

// Wrapper components to handle routing params
function WebCoachWrapper() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const setSelectedCareerPath = useNavigationStore((state) => state.setSelectedCareerPath);

  return (
    <WebCoachDashboard
      onLogout={() => {
        logout();
        navigate('/login');
      }}
      onNavigateToCareerPath={(path: string) => {
        setSelectedCareerPath(path);
        navigate(`/career-path/${path}`);
      }}
      onNavigateToSkill={() => {
        // Skill detail page removed
      }}
    />
  );
}

function CareerPathWrapper() {
  const navigate = useNavigate();
  const { pathId } = useParams<{ pathId: string }>();

  return (
    <CareerPathPage
      careerPath={pathId || 'web-designer'}
      onBack={() => navigate('/webcoach')}
    />
  );
}

function CoursesWrapper() {
  return <MaterialsTopPage />;
}

function AreaCoursesWrapper() {
  return <AreaCoursesPage />;
}

function LearningCoursesWrapper() {
  return <LearningCoursesPage />;
}

function AiCoachWrapper() {
  return <AiCoachPage />;
}

function ContentListWrapper() {
  const navigate = useNavigate();
  return <ContentListPage onBack={() => navigate('/webcoach')} />;
}

function MyPageWrapper() {
  return <MyPage />;
}

function ProfilePageWrapper() {
  return <ProfilePage />;
}

function CourseCurriculumWrapper() {
  return <CourseTopPage />;
}

/**
 * dev/kanegae統合: 教材表示は dev/kanegae の実装(CourseContentPage、実Moodle教材を
 * iframe描画)をそのまま使う。dev/miyabeのLearningWorkspacePage（構造化教材/LessonDoc）は
 * 裏のAPIがモックのみで実データを返せないため、ここには接続しない。
 * TODO(教材表示アーキテクチャ未決定): CourseContentPage(実装・稼働中) と
 *   LearningWorkspacePage(構造化ブロック・モック中心)の統合方針は未決定のまま。
 *   LearningWorkspacePage自体はコードとして残っている（将来ここへ差し替える候補）。
 */
function CourseContentWrapper() {
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const moduleId = searchParams.get('module');

  return (
    <CourseContentPage
      courseId={parseInt(courseId || '0', 10)}
      initialModuleId={moduleId ? parseInt(moduleId, 10) : undefined}
      onBack={() => navigate(`/course/${courseId}/curriculum`)}
    />
  );
}

function BadgesPageWrapper() {
  return <BadgesPage />;
}

function CoachingScheduleWrapper() {
  const { studentId } = useParams<{ studentId: string }>();
  return <CoachingSchedulePage studentId={parseInt(studentId || '0', 10)} />;
}

function AppRoutes() {
  // AI専用ページを離れたときの後始末（戻り先の破棄／ブラウザバック時のドロワー復帰）。
  // 教材ページは AppHeader を描かないので、全遷移を見られるここに置く。
  useAiCoachExpandOriginCleanup();

  return (
    <ErrorBoundary>
    <Routes>
      <Route
        path="/login"
        element={
          <AnimatedPage>
            <LoginPage />
          </AnimatedPage>
        }
      />

      <Route
        path="/password-reset"
        element={
          <AnimatedPage>
            <PasswordResetPage />
          </AnimatedPage>
        }
      />

      {/*
        コーチ向けの録画連携ページ。コーチはLMSのアカウントを持たないため、
        ここだけは意図的に ProtectedRoute の外に置く（未ログインで到達できる必要がある）。
      */}
      <Route
        path="/connect/:token"
        element={
          <AnimatedPage>
            <ConnectCoachPage />
          </AnimatedPage>
        }
      />

      <Route
        path="/mypage"
        element={
          <ProtectedRoute>
            <MyPageWrapper />
          </ProtectedRoute>
        }
      />

      {/*
        dev/miyabeは「集中ブースは廃止し、自動記録(StudySessionHost.tsx)に一本化する」方針で
        ここを /study-log へのリダイレクトにしていたが、dev/kanegae統合では実装済み・実バックエンド
        接続済みのFocusBoothPage（下の /focus-booth ルート）を優先して残す
        （dev/kanegaeの実装で取得できるものはそれを使う方針）。StudySessionHost自体はApp直下に
        常駐しており引き続き動作する（自動記録とFocusBoothPage、両方の入り口が併存する）。
        TODO: 学習時間まわりのUI導線が2系統(集中ブース/自動記録+学習記録)残っている状態。
        将来的にどちらかへ一本化するか要検討。
      */}

      {/* 学習記録の詳細（累計・日別グラフ・全履歴）。トップの「学習記録を見る」からの掘り下げ。 */}
      <Route
        path="/study-log"
        element={
          <ProtectedRoute>
            <StudyLogPage />
          </ProtectedRoute>
        }
      />

      {/*
        dev/kanegae統合: /coaching は下の方で dev/kanegae の実装(MyCoachingPage、
        実装済みのOAuth型連携・録画・スケジュール・AIコーチングノートに接続)へルーティングする。
        dev/miyabeのCoachingNotesPage（招待URL型連携の想定）は、その前提(Google Meet
        Organizer中心モデルへの方針転換)が既に陳腐化しているためルートに接続しない
        （ファイルはTODOとして残置。実装しないと決めたわけではない）。
      */}

      {/*
        長期学習ロードマップ。閲覧・編集・確定をすべて受講生側で行う（コーチはLMSを操作しない運用）。
        より具体的な /learning-plan/setup を先に置く。
      */}
      <Route
        path="/learning-plan/setup"
        element={
          <ProtectedRoute>
            <LearningPlanSetupPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/learning-plan"
        element={
          <ProtectedRoute>
            <LearningPlanPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePageWrapper />
          </ProtectedRoute>
        }
      />

      {/* 利用マニュアル・よくある質問。以前はサイドバーから外部Notionを別タブで開いていた */}
      <Route
        path="/help/manual"
        element={
          <ProtectedRoute>
            <HelpPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/help/faq"
        element={
          <ProtectedRoute>
            <HelpPage />
          </ProtectedRoute>
        }
      />
      <Route path="/help" element={<Navigate to="/help/manual" replace />} />

      <Route
        path="/coaching"
        element={
          <ProtectedRoute>
            <MyCoachingPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/focus-booth"
        element={
          <ProtectedRoute>
            <FocusBoothPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/roadmap"
        element={
          <ProtectedRoute>
            <RoadmapPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/account-settings"
        element={
          <ProtectedRoute>
            <AccountSettingsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/webcoach"
        element={
          <ProtectedRoute>
            <WebCoachWrapper />
          </ProtectedRoute>
        }
      />

      <Route
        path="/career-path/:pathId"
        element={
          <ProtectedRoute>
            <CareerPathWrapper />
          </ProtectedRoute>
        }
      />

      <Route
        path="/courses"
        element={
          <ProtectedRoute>
            <CoursesWrapper />
          </ProtectedRoute>
        }
      />

      <Route
        path="/ai-coach"
        element={
          <ProtectedRoute>
            <AiCoachWrapper />
          </ProtectedRoute>
        }
      />

      {/* 旧「AIアプリ一覧」。AIコーチに内包したので転送する。
          既存のブックマークや社内共有リンクを壊さないために残している。 */}
      <Route path="/ai-apps" element={<Navigate to="/ai-coach" replace />} />

      {/* 学習領域のコース一覧。
          🔴 一度「領域だけのページは廃止（見出しとして見せるもので、独立して辿る
             階層ではない）」と判断してリダイレクトにしていたが、初見の人に構造が
             伝わらないという指摘を受けて復活させた。学習トップは領域の地図、
             絞り込み・並び替えのある一覧はこちら、の2段。
          パラメータは領域code（11/21/…）。未知のカテゴリ名も受ける。 */}
      <Route
        path="/courses/category/:categoryId"
        element={
          <ProtectedRoute>
            <AreaCoursesWrapper />
          </ProtectedRoute>
        }
      />

      <Route
        path="/learning-courses"
        element={
          <ProtectedRoute>
            <LearningCoursesWrapper />
          </ProtectedRoute>
        }
      />

      <Route
        path="/content-list"
        element={
          <ProtectedRoute>
            <ContentListWrapper />
          </ProtectedRoute>
        }
      />

<Route
        path="/course/:courseId/curriculum"
        element={
          <ProtectedRoute>
            <CourseCurriculumWrapper />
          </ProtectedRoute>
        }
      />

      <Route
        path="/course/:courseId"
        element={
          <ProtectedRoute>
            <CourseContentWrapper />
          </ProtectedRoute>
        }
      />

      {/* ノート（自習室タブの3つ目）：メモ・クリップ・保存したAI回答の横断管理 */}
      <Route
        path="/notes"
        element={
          <ProtectedRoute>
            <MyNotesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/badges"
        element={
          <ProtectedRoute>
            <BadgesPageWrapper />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<Navigate to="/admin/create-course" replace />} />
        <Route path="courses" element={<AdminCsvPage key="courses" dataType="courses" />} />
        <Route path="categories" element={<AdminCsvPage key="categories" dataType="categories" />} />
        <Route path="enrollments" element={<AdminCsvPage key="enrollments" dataType="enrollments" />} />
        <Route path="image-upload" element={<AdminImageUploadPage />} />
        <Route path="cognito-users" element={<AdminCognitoUsersPage />} />
        <Route path="students" element={<AdminStudentsPage />} />
        <Route path="create-course" element={<AdminCsvPage key="moodle-courses" dataType="moodle-courses" />} />
        <Route path="ai-applications" element={<AdminCsvPage key="ai-applications" dataType="ai-applications" />} />
        <Route path="avatars" element={<AdminCsvPage key="avatars" dataType="avatars" />} />
        <Route path="vector-data" element={<AdminVectorPage />} />
        <Route path="coach-mapping" element={<AdminCoachMappingPage />} />
        <Route path="coach-integrations" element={<AdminCoachIntegrationsPage />} />
      </Route>

      <Route
        path="/coach/students"
        element={
          <CoachRoute>
            <CoachStudentsPage />
          </CoachRoute>
        }
      />

      <Route
        path="/coach/schedule/:studentId"
        element={
          <CoachRoute>
            <CoachingScheduleWrapper />
          </CoachRoute>
        }
      />

      <Route
        path="/coach/settings"
        element={
          <CoachRoute>
            <CoachSettingsPage />
          </CoachRoute>
        }
      />

      {MOCKS_ENABLED && (
        <Route
          path="/dev/catalog"
          element={
            <React.Suspense fallback={<div style={{ minHeight: '100vh', background: '#FBF8F4' }} />}>
              <DevCatalogPage />
            </React.Suspense>
          }
        />
      )}

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    </ErrorBoundary>
  );
};

export default AppRoutes;
