import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import PortalLayout from '@/layouts/PortalLayout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import { Loader2 } from 'lucide-react';

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const BatchesPage = lazy(() => import('@/pages/batches/BatchesPage'));
const BatchDetailPage = lazy(() => import('@/pages/batches/BatchDetailPage'));
const NewBatchPage = lazy(() => import('@/pages/batches/NewBatchPage'));
const EditBatchPage = lazy(() => import('@/pages/batches/EditBatchPage'));
const StudentsPage = lazy(() => import('@/pages/students/StudentsPage'));
const NewStudentPage = lazy(() => import('@/pages/students/NewStudentPage'));
const StudentDetailPage = lazy(() => import('@/pages/students/StudentDetailPage'));
const TutorsPage = lazy(() => import('@/pages/tutors/TutorsPage'));
const NewTutorPage = lazy(() => import('@/pages/tutors/NewTutorPage'));
const TutorDetailPage = lazy(() => import('@/pages/tutors/TutorDetailPage'));
const AttendancePage = lazy(() => import('@/pages/attendance/AttendancePage'));
const FeesPage = lazy(() => import('@/pages/fees/FeesPage'));
const AssignmentsPage = lazy(() => import('@/pages/assignments/AssignmentsPage'));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const LoginChoicePage = lazy(() => import('@/pages/auth/LoginChoicePage'));
const UserLoginPage = lazy(() => import('@/pages/auth/UserLoginPage'));

const PortalOverviewPage = lazy(() => import('@/pages/portal/PortalOverviewPage'));
const PortalAttendancePage = lazy(() => import('@/pages/portal/PortalAttendancePage'));
const PortalAssignmentsPage = lazy(() => import('@/pages/portal/PortalAssignmentsPage'));
const PortalFeesPage = lazy(() => import('@/pages/portal/PortalFeesPage'));

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/auth/login" element={<LoginChoicePage />} />
        <Route path="/auth/login/admin" element={<LoginPage />} />
        <Route path="/auth/login/user" element={<UserLoginPage />} />

        <Route path="/" element={<ProtectedRoute role="admin" />}>
          <Route element={<DashboardLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="batches" element={<BatchesPage />} />
            <Route path="batches/new" element={<NewBatchPage />} />
            <Route path="batches/:batchId" element={<BatchDetailPage />} />
            <Route path="batches/:batchId/edit" element={<EditBatchPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="students/new" element={<NewStudentPage />} />
            <Route path="students/:studentId" element={<StudentDetailPage />} />
            <Route path="tutors" element={<TutorsPage />} />
            <Route path="tutors/new" element={<NewTutorPage />} />
            <Route path="tutors/:tutorId" element={<TutorDetailPage />} />
            <Route path="attendance" element={<AttendancePage />} />
            <Route path="fees" element={<FeesPage />} />
            <Route path="assignments" element={<AssignmentsPage />} />
          </Route>
        </Route>

        {/* Student portal — read-only view of the student's own record. Adding a section
            is a route here plus an entry in portalNavItems. */}
        <Route path="/portal" element={<ProtectedRoute role="student" />}>
          <Route element={<PortalLayout />}>
            <Route index element={<PortalOverviewPage />} />
            <Route path="attendance" element={<PortalAttendancePage />} />
            <Route path="assignments" element={<PortalAssignmentsPage />} />
            <Route path="fees" element={<PortalFeesPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
