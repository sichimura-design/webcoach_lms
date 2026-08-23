import React from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import LoginPage from '../components/LoginPage';
import PasswordResetPage from '../components/PasswordResetPage';
import MyPage from '../components/MyPage';
import StudyLogPage from '../components/studyLog/StudyLogPage';
import CoachingNotesPage from '../components/CoachingNotesPage';
import LearningPlanPage from '../components/learningPlan/LearningPlanPage';
import LearningPlanSetupPage from '../components/learningPlan/LearningPlanSetupPage';
import ConnectCoachPage from '../components/ConnectCoachPage';
import ProfilePage from '../components/ProfilePage';
import WebCoachDashboard from '../components/WebCoachDashboard';
import CareerPathPage from '../components/CareerPathPage';
import MaterialsTopPage from '../components/MaterialsTopPage';
import LearningCoursesPage from '../components/LearningCoursesPage';
import AiCoachPage from '../components/aicoach/AiCoachPage';
import BadgesPage from '../components/BadgesPage';
import ContentListPage from '../components/ContentListPage';
import LearningWorkspacePage from '../components/learning/LearningWorkspacePage';
import MyNotesPage from '../components/notes/MyNotesPage';
import CourseTopPage from '../components/CourseTopPage';
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
import { useAuth } from '../contexts/AuthContext';
import { useNavigationStore } from '../store/navigationStore';
import { ErrorBoundary } from '../components/shared';

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

function CourseContentWrapper() {
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const moduleId = searchParams.get('module');

  return (
    <LearningWorkspacePage
      // レッスンを切り替えると ?module= が置き換わる。key で再マウントすると
      // パネル状態と会話が毎回リセットされてしまうため、key は courseId のみに紐づける。
      key={courseId}
      courseId={parseInt(courseId || '0', 10)}
      initialModuleId={moduleId ? parseInt(moduleId, 10) : undefined}
      onBack={() => navigate(`/course/${courseId}/curriculum`)}
    />
  );
}

function BadgesPageWrapper() {
  return <BadgesPage />;
}

function AppRoutes() {
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

      {/* 集中ブースは廃止した。学習時間は各行動の開始時に自動で記録が始まる仕組みに
          置き換わったので、タイマーを設定しに行くページ自体が不要になった
          （components/shared/StudySessionHost.tsx）。旧ブックマークは学習記録へ送る。 */}
      <Route path="/focus-booth" element={<Navigate to="/study-log" replace />} />

      {/* 学習記録の詳細（累計・日別グラフ・全履歴）。トップの「学習記録を見る」からの掘り下げ。 */}
      <Route
        path="/study-log"
        element={
          <ProtectedRoute>
            <StudyLogPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/coaching"
        element={
          <ProtectedRoute>
            <CoachingNotesPage />
          </ProtectedRoute>
        }
      />

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
        path="/account-settings"
        element={
          <ProtectedRoute>
            <AnimatedPage><AccountSettingsPage /></AnimatedPage>
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

      {/* 学習領域（カテゴリ）だけのページは廃止した。学習領域は「学習する」の中の
          見出しとして見せるもので、独立して辿る階層ではない。旧リンクは一覧へ送る。 */}
      <Route path="/courses/category/:categoryId" element={<Navigate to="/courses" replace />} />

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

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
    </ErrorBoundary>
  );
};

export default AppRoutes;
