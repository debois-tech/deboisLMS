import { getAttendanceByBatch, getBatchStudents, getLecturesByBatch } from '@/lib/supabase';
import { formatDate } from '@/lib/utils/format';
import { toCsv, downloadCsv, toFileStem } from '@/lib/utils/csvExport';

const STATUS_LABEL: Record<string, string> = { present: 'Present', partial: 'Partial', absent: 'Absent' };

// One row per student, one column per lecture — the batch's whole attendance history at once.
export async function exportBatchAttendanceCsv(batchId: string, batchName: string): Promise<void> {
  const [lectures, students, attendance] = await Promise.all([
    getLecturesByBatch(batchId),
    getBatchStudents(batchId),
    getAttendanceByBatch(batchId),
  ]);

  const sorted = [...lectures].sort(
    (a, b) => new Date(a.start_at ?? a.lecture_date).getTime() - new Date(b.start_at ?? b.lecture_date).getTime(),
  );

  // Same-day lectures get the start time added, so their columns don't collide.
  const lecturesPerDate = new Map<string, number>();
  for (const lecture of sorted) {
    const date = formatDate(lecture.lecture_date);
    lecturesPerDate.set(date, (lecturesPerDate.get(date) ?? 0) + 1);
  }

  const headers = ['Student', ...sorted.map((lecture) => {
    const date = formatDate(lecture.lecture_date);
    if ((lecturesPerDate.get(date) ?? 0) <= 1) return date;
    const time = new Date(lecture.start_at ?? lecture.lecture_date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    return `${date} ${time}`;
  })];

  const statusByKey = new Map(attendance.map((record) => [`${record.student_id}:${record.lecture_id}`, record.status]));

  const rows = students.map((student) => [
    student.name,
    ...sorted.map((lecture) => STATUS_LABEL[statusByKey.get(`${student.id}:${lecture.id}`) ?? ''] ?? ''),
  ]);

  downloadCsv(`${toFileStem(batchName)}-attendance.csv`, toCsv(headers, rows));
}
