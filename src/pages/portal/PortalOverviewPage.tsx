import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, CalendarClock, FileText, PartyPopper, UserPlus, Wallet } from 'lucide-react';
import {
  PortalEmpty,
  PortalFocus,
  PortalList,
  PortalPage,
  PortalRow,
  PortalSection,
  PortalStat,
  PortalStatGrid,
  PortalStatus,
  usePortalStudentId,
} from '@/components/portal';
import {
  ATTENDANCE_PARTIAL_PERCENT,
  getApprovedAttendanceByStudent,
  getAssignmentsForStudent,
  getFeesByStudent,
  getLecturesByBatch,
  getStudentById,
  getStudentBatches,
} from '@/lib/supabase';
import type {
  Assignment,
  AssignmentCompletion,
  AttendanceRecord,
  Batch,
  BatchStudentMapping,
  Lecture,
  Student,
  StudentFee,
} from '@/lib/types';
import { useAuth } from '@/lib/context/AuthContext';
import { formatCurrency, formatDate, formatDayLabel } from '@/lib/utils/format';

type Enrollment = BatchStudentMapping & { batch?: Batch };
type StudentAssignment = Assignment & { completion?: AssignmentCompletion };

export default function PortalOverviewPage() {
  const studentId = usePortalStudentId();
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [nextLecture, setNextLecture] = useState<Lecture | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  // Seeded from whether there is anything to load, so the no-student case never
  // needs a synchronous setState inside the effect below.
  const [loading, setLoading] = useState(Boolean(studentId));

  useEffect(() => {
    if (!studentId) return;

    let active = true;

    (async () => {
      // Fees are fetched for the student, not for one batch: Home used to show
      // the current batch's balance while the Fees tab showed the total across
      // every batch, so the same word meant two different numbers.
      const [record, mappings, records, work, feeRows] = await Promise.all([
        getStudentById(studentId),
        getStudentBatches(studentId),
        getApprovedAttendanceByStudent(studentId),
        getAssignmentsForStudent(studentId),
        getFeesByStudent(studentId),
      ]);

      // `getStudentBatches` joins the batch in, so there is no per-mapping fetch.
      const withBatches = mappings;

      // Multiple active batches are possible; the most recently joined one is "current".
      const currentMapping = withBatches
        .filter((mapping) => mapping.status === 'active')
        .sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime())[0];

      let upcoming: Lecture | null = null;

      if (currentMapping) {
        const lectures = await getLecturesByBatch(currentMapping.batch_id);
        const today = new Date().toISOString().slice(0, 10);
        upcoming = lectures
          .filter((lecture) => lecture.lecture_date.slice(0, 10) >= today)
          .sort((a, b) => a.lecture_date.localeCompare(b.lecture_date))[0] ?? null;
      }

      if (!active) return;
      setStudent(record ?? null);
      setEnrollments(withBatches);
      setFees(feeRows);
      setNextLecture(upcoming);
      setAttendance(records);
      setAssignments(work);
      setLoading(false);
    })();

    return () => { active = false; };
  }, [studentId]);

  const currentBatch = enrollments
    .filter((enrollment) => enrollment.status === 'active')
    .sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime())[0]?.batch;

  const attended = attendance.filter((record) => record.status !== 'absent').length;
  const attendanceRate = attendance.length > 0 ? Math.round((attended / attendance.length) * 100) : null;
  const handedIn = assignments.filter((item) => item.completion?.submitted).length;
  const pending = assignments.length - handedIn;
  // Totals across every batch, matching the Fees tab exactly.
  const totalFee = fees.reduce((sum, fee) => sum + Number(fee.total_fee), 0);
  const totalPaid = fees.reduce((sum, fee) => sum + Number(fee.paid_amount), 0);
  const outstanding = totalFee - totalPaid;

  const name = student?.name ?? user?.full_name ?? 'there';
  const firstName = name.split(' ')[0];

  return (
    <PortalPage title={`Hi, ${firstName}`} loading={loading}>
      {!studentId ? (
        <PortalEmpty icon={UserPlus}>Student record not linked.</PortalEmpty>
      ) : (
        <>
          <NextUp
            batchName={currentBatch?.name}
            lecture={nextLecture}
            pending={pending}
            outstanding={outstanding}
            enrolled={Boolean(currentBatch)}
          />

          <PortalStatGrid>
            <PortalStat
              label="Attendance"
              icon={CalendarCheck}
              value={attendanceRate === null ? 'Not started' : `${attendanceRate}%`}
              tone={attendanceRate === null ? 'default' : attendanceRate >= ATTENDANCE_PARTIAL_PERCENT ? 'positive' : 'attention'}
              progress={attendanceRate ?? undefined}
              note={
                attendance.length > 0
                  ? `${attended} of ${attendance.length} classes`
                    : 'No classes yet'
              }
            />
            <PortalStat
              label="Assignments"
              icon={FileText}
              value={assignments.length === 0 ? 'None yet' : `${handedIn} of ${assignments.length}`}
              tone={assignments.length === 0 ? 'default' : pending > 0 ? 'attention' : 'positive'}
              progress={assignments.length > 0 ? (handedIn / assignments.length) * 100 : undefined}
              note={
                assignments.length === 0
                  ? 'Nothing set yet'
                  : pending > 0
                    ? `${pending} to hand in`
                    : 'All handed in'
              }
            />
            <PortalStat
              label="Fees"
              icon={Wallet}
              value={fees.length === 0 ? 'Not set' : outstanding > 0 ? formatCurrency(outstanding) : 'All paid'}
              tone={fees.length === 0 ? 'default' : outstanding > 0 ? 'attention' : 'positive'}
              note={
                fees.length === 0
                  ? 'Not set yet'
                  : outstanding > 0
                    ? `of ${formatCurrency(totalFee)} total`
                    : `${formatCurrency(totalFee)} paid`
              }
            />
          </PortalStatGrid>

          <PortalSection title="Batches">
            {enrollments.length === 0 ? (
              <PortalEmpty icon={UserPlus}>Not in a batch yet.</PortalEmpty>
            ) : (
              <PortalList>
                {enrollments.map((enrollment) => (
                  <PortalRow
                    key={enrollment.id}
                    primary={enrollment.batch?.name ?? 'Batch'}
                    secondary={`Joined ${formatDate(enrollment.joined_at)}`}
                    trailing={<PortalStatus kind="enrollment" value={enrollment.status} />}
                  />
                ))}
              </PortalList>
            )}
          </PortalSection>
        </>
      )}
    </PortalPage>
  );
}

/**
 * The one thing worth acting on, picked in the order a student would care about
 * it: the next class, then work that is still due, then money owed. "Nothing to
 * do" is a real answer and gets said out loud rather than leaving the slot blank.
 */
function NextUp({
  batchName,
  lecture,
  pending,
  outstanding,
  enrolled,
}: {
  batchName?: string;
  lecture: Lecture | null;
  pending: number;
  outstanding: number;
  enrolled: boolean;
}) {
  if (!enrolled) {
    return (
      <PortalFocus icon={UserPlus} title="Not in a batch yet" />
    );
  }

  if (lecture) {
    const day = formatDayLabel(lecture.lecture_date);
    const relative = day === 'Today' || day === 'Tomorrow';
    const where = lecture.session_type === 'online'
      ? ['Online', lecture.meeting_code].filter(Boolean).join(' · ')
      : 'In person';

    return (
      <PortalFocus
        icon={CalendarClock}
        title={`Next class ${relative ? day.toLowerCase() : day}`}
        detail={[batchName, where].filter(Boolean).join(' · ')}
      />
    );
  }

  if (pending > 0) {
    return (
      <PortalFocus
        icon={FileText}
        title={`${pending} ${pending === 1 ? 'assignment' : 'assignments'} to hand in`}
        action={<Link to="/portal/assignments" className="portal-focus-link">Open</Link>}
      />
    );
  }

  if (outstanding > 0) {
    return (
      <PortalFocus
        icon={Wallet}
        title={`${formatCurrency(outstanding)} due`}
        action={<Link to="/portal/fees" className="portal-focus-link">Details</Link>}
      />
    );
  }

  return <PortalFocus icon={PartyPopper} title="All caught up" />;
}
