export { getBatches, getBatchById, createBatch, updateBatch, deleteBatch } from './queries/batches';
export { getStudents, getStudentById, createStudent, updateStudent, getStudentBatches, getBatchStudents, addStudentToBatch, removeStudentFromBatch } from './queries/students';
export { getTutors, getTutorById, createTutor, getBatchTutors, assignTutorToBatch, removeTutorFromBatch } from './queries/tutors';
export { getLecturesByBatch, getLectureById, createLecture, deleteLecture } from './queries/lectures';
export { getUploadsByLecture, getAttendanceByLecture, insertUploadRows, processAttendance, approveAttendance, bulkApproveAttendance, getUnapprovedCount } from './queries/attendance';
export { getFeesByBatch, updateFeePayment, getBatchFeeSummary } from './queries/fees';
export { getAssignmentsByBatch, createAssignment, getCompletionsByAssignment, markSubmission } from './queries/assignments';
export { getDashboardStats, getRecentActivity } from './queries/dashboard';
export type { DashboardStats, RecentActivity } from './queries/dashboard';