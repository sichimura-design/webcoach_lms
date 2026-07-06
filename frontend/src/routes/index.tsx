import React from 'react';
import { Routes, Route, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import LoginPage from '../components/LoginPage';
import PasswordResetPage from '../components/PasswordResetPage';
import MyPage from '../components/MyPage';
import ProfilePage from '../components/ProfilePage';
import WebCoachDashboard from '../components/WebCoachDashboard';
import CareerPathPage from '../components/CareerPathPage';
import CoursesPage from '../components/CoursesPage';
import LearningCoursesPage from '../components/LearningCoursesPage';
import CategoryDetailPage from '../components/CategoryDetailPage';
import AIAppsPage from '../components/AIAppsPage';
import BadgesPage from '../components/BadgesPage';
import AnnouncementsPage from '../components/AnnouncementsPage';
import ContentListPage from '../components/ContentListPage';
import CourseContentPage from '../components/CourseContentPage';
import CourseCurriculumPage from '../components/CourseCurriculumPage';
import AccountSettingsPage from '../components/AccountSettingsPage';
import AnimatedPage from '../components/AnimatedPage';
import { AdminLayout } from '../components/admin/AdminLayout';
import { AdminCsvPage } from '../components/admin/AdminCsvPage';
import { AdminCognitoUsersPage } from '../components/admin/AdminCognitoUsersPage';
import { AdminImageUploadPage } from '../components/admin/AdminImageUploadPage';
import { AdminVectorPage } from '../components/admin/AdminVectorPage';
import { AdminStudentsPage } from '../components/admin/AdminStudentsPage';
import { AdminCoachMappingPage } from '../components/admin/AdminCoachMappingPage';
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
  return <CoursesPage />;
}

function LearningCoursesWrapper() {
  return <LearningCoursesPage />;
}

function CategoryDetailWrapper() {
  return <CategoryDetailPage />;
}

function AIAppsWrapper() {
  return <AIAppsPage />;
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
  return <CourseCurriculumPage />;
}

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

      <Route
        path="/mypage"
        element={
          <ProtectedRoute>
            <MyPageWrapper />
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
        path="/ai-apps"
        element={
          <ProtectedRoute>
            <AIAppsWrapper />
          </ProtectedRoute>
        }
      />

      <Route
        path="/courses/category/:categoryId"
        element={
          <ProtectedRoute>
            <CategoryDetailWrapper />
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

      <Route
        path="/badges"
        element={
          <ProtectedRoute>
            <BadgesPageWrapper />
          </ProtectedRoute>
        }
      />

      <Route
        path="/announcements"
        element={
          <ProtectedRoute>
            <AnnouncementsPage />
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
