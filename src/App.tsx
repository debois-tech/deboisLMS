import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
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
const UserLoginPlaceholderPage = lazy(() => import('@/pages/auth/UserLoginPlaceholderPage'));

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
        <Route path="/auth/login/user" element={<UserLoginPlaceholderPage />} />
        <Route path="/" element={<ProtectedRoute />}>
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
      </Routes>
    </Suspense>
  );
}
