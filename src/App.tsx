import { Routes, Route } from 'react-router-dom';
import DashboardLayout from '@/layouts/DashboardLayout';
import ProtectedRoute from '@/components/layout/ProtectedRoute';
import DashboardPage from '@/pages/DashboardPage';
import BatchesPage from '@/pages/batches/BatchesPage';
import BatchDetailPage from '@/pages/batches/BatchDetailPage';
import NewBatchPage from '@/pages/batches/NewBatchPage';
import EditBatchPage from '@/pages/batches/EditBatchPage';
import StudentsPage from '@/pages/students/StudentsPage';
import NewStudentPage from '@/pages/students/NewStudentPage';
import StudentDetailPage from '@/pages/students/StudentDetailPage';
import TutorsPage from '@/pages/tutors/TutorsPage';
import NewTutorPage from '@/pages/tutors/NewTutorPage';
import TutorDetailPage from '@/pages/tutors/TutorDetailPage';
import AttendancePage from '@/pages/attendance/AttendancePage';
import FeesPage from '@/pages/fees/FeesPage';
import AssignmentsPage from '@/pages/assignments/AssignmentsPage';
import LoginPage from '@/pages/auth/LoginPage';

export default function App() {
  return (
    <Routes>
      <Route path="/auth/login" element={<LoginPage />} />
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
  );
}
