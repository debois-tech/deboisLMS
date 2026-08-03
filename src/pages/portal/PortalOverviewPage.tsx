import { useEffect, useState } from 'react';
import { CalendarDays, Clock, Layers, Mail, Phone, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { PortalEmpty, PortalPage, PortalRow, PortalStat, usePortalStudentId } from '@/components/portal/PortalPage';
import {
  getApprovedAttendanceByStudent,
  getBatchById,
  getFeesByStudent,
  getLecturesByBatch,
  getStudentById,
  getStudentBatches,
} from '@/lib/supabase';
import type { AttendanceRecord, Batch, BatchStudentMapping, Lecture, Student, StudentFee } from '@/lib/types';
import { useAuth } from '@/lib/context/AuthContext';
import { formatCurrency, formatDate } from '@/lib/utils/format';

type Enrollment = BatchStudentMapping & { batch?: Batch };

export default function PortalOverviewPage() {
  const studentId = usePortalStudentId();
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [currentFee, setCurrentFee] = useState<StudentFee | null>(null);
  const [nextLecture, setNextLecture] = useState<Lecture | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    let active = true;

    (async () => {
      const [record, mappings, records] = await Promise.all([
        getStudentById(studentId),
        getStudentBatches(studentId),
        getApprovedAttendanceByStudent(studentId),
      ]);

      const withBatches = await Promise.all(
        mappings.map(async (mapping) => ({ ...mapping, batch: await getBatchById(mapping.batch_id) })),
      );

      // Multiple active batches are possible; the most recently joined one is "current".
      const currentMapping = withBatches
        .filter((mapping) => mapping.status === 'active')
        .sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime())[0];

      let fee: StudentFee | null = null;
      let upcoming: Lecture | null = null;

      if (currentMapping) {
        const [fees, lectures] = await Promise.all([
          getFeesByStudent(studentId),
          getLecturesByBatch(currentMapping.batch_id),
        ]);
        fee = fees.find((f) => f.batch_id === currentMapping.batch_id) ?? null;

        const today = new Date().toISOString().slice(0, 10);
        upcoming = lectures
          .filter((lecture) => lecture.lecture_date.slice(0, 10) >= today)
          .sort((a, b) => a.lecture_date.localeCompare(b.lecture_date))[0] ?? null;
      }

      if (!active) return;
      setStudent(record ?? null);
      setEnrollments(withBatches);
      setCurrentFee(fee);
      setNextLecture(upcoming);
      setAttendance(records);
      setLoading(false);
    })();

    return () => { active = false; };
  }, [studentId]);

  const currentBatch = enrollments
    .filter((enrollment) => enrollment.status === 'active')
    .sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime())[0]?.batch;

  const attended = attendance.filter((record) => record.status !== 'absent').length;
  const attendanceRate = attendance.length > 0 ? Math.round((attended / attendance.length) * 100) : null;
  const outstanding = currentFee ? Number(currentFee.total_fee) - Number(currentFee.paid_amount) : 0;
  const name = student?.name ?? user?.full_name ?? 'Student';

  return (
    <PortalPage title="Overview" loading={loading}>
      {!studentId ? (
        <PortalEmpty>
          This login isn't linked to a student record yet. Ask your coordinator to set it up.
        </PortalEmpty>
      ) : (
        <>
          <div className="portal-identity">
            <div className="portal-avatar">
              {name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
            </div>
            <div className="min-w-0">
              <p className="portal-name">{name}</p>
              <div className="portal-meta">
                {student?.email && (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Mail size={13} className="shrink-0" />
                    <span className="break-all">{student.email}</span>
                  </span>
                )}
                {student?.phone && (
                  <span className="flex items-center gap-1.5">
                    <Phone size={13} className="shrink-0" />
                    {student.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="portal-stat-grid">
            <PortalStat
              label="Current batch"
              icon={Layers}
              value={currentBatch?.name ?? '—'}
              note={currentBatch?.track ?? 'Not enrolled in any batch'}
            />
            <PortalStat
              label="Next lecture"
              icon={Clock}
              value={nextLecture ? formatDate(nextLecture.lecture_date) : '—'}
              note={
                nextLecture
                  ? `${nextLecture.session_type}${nextLecture.meeting_code ? ` · ${nextLecture.meeting_code}` : ''}`
                  : currentBatch ? 'No lectures scheduled' : undefined
              }
            />
            <PortalStat
              label="Attendance"
              icon={CalendarDays}
              value={attendanceRate === null ? '—' : `${attendanceRate}%`}
              note={attendance.length > 0 ? `${attended} of ${attendance.length} lectures` : 'No records yet'}
            >
              {attendanceRate !== null && (
                <div className="portal-progress">
                  <div className="portal-progress-fill" style={{ transform: `scaleX(${attendanceRate / 100})` }} />
                </div>
              )}
            </PortalStat>
            <PortalStat
              label="Fees"
              icon={Wallet}
              value={currentFee ? formatCurrency(Number(currentFee.paid_amount)) : '—'}
              note={
                currentFee
                  ? outstanding > 0
                    ? `${formatCurrency(outstanding)} due of ${formatCurrency(Number(currentFee.total_fee))}`
                    : 'Paid in full'
                  : 'No fee record'
              }
            />
          </div>

          <section>
            <h2 className="portal-page-title">Batches</h2>
            <div className="mt-3">
              {enrollments.length === 0 ? (
                <PortalEmpty>You aren't enrolled in a batch yet.</PortalEmpty>
              ) : (
                <div className="portal-list">
                  {enrollments.map((enrollment) => (
                    <PortalRow
                      key={enrollment.id}
                      primary={enrollment.batch?.name ?? 'Batch'}
                      secondary={`Joined ${formatDate(enrollment.joined_at)}`}
                      trailing={
                        <Badge variant={enrollment.status === 'active' ? 'success' : 'default'} dot>
                          {enrollment.status}
                        </Badge>
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </PortalPage>
  );
}
