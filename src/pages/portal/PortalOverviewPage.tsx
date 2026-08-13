import { useState } from 'react';
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
  getFeePaymentLogsByStudent,
  getMyFeeDues,
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
  FeePaymentLog,
  Lecture,
  Student,
  StudentFeeDue,
} from '@/lib/types';
import { StudentIdChip } from '@/components/students/StudentLink';
import { useAuth } from '@/lib/context/AuthContext';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { useNow } from '@/lib/hooks/useNow';
import { assignmentState } from '@/lib/utils/deadline';
import { deriveBatchStatus, formatCurrency, formatDate, formatDayLabel } from '@/lib/utils/format';
import { countInstallmentPayments, dueInstallment, installmentLabel } from '@/lib/utils/installments';
import type { InstallmentDue } from '@/lib/utils/installments';

type Enrollment = BatchStudentMapping & { batch?: Batch };
type StudentAssignment = Assignment & { completion?: AssignmentCompletion };

export default function PortalOverviewPage() {
  const studentId = usePortalStudentId();
  const { user } = useAuth();
  const [student, setStudent] = useState<Student | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [fees, setFees] = useState<StudentFeeDue[]>([]);
  const [nextLecture, setNextLecture] = useState<Lecture | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [payments, setPayments] = useState<FeePaymentLog[]>([]);
  const now = useNow();
  const { loading, error, retry } = useInitialLoad(async () => {
    if (!studentId) return;

    // Fees are fetched for the student, not for one batch: Home used to show
    // the current batch's balance while the Fees tab showed the total across
    // every batch, so the same word meant two different numbers.
    const [record, mappings, records, work, feeRows, paymentRows] = await Promise.all([
      getStudentById(studentId),
      getStudentBatches(studentId),
      getApprovedAttendanceByStudent(studentId),
      getAssignmentsForStudent(studentId),
      getMyFeeDues(),
      getFeePaymentLogsByStudent(studentId),
    ]);

    // Multiple active batches are possible; the most recently joined one is "current".
    const currentMapping = mappings
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

    setStudent(record ?? null);
    // `getStudentBatches` joins the batch in, so there is no per-mapping fetch.
    setEnrollments(mappings);
    setFees(feeRows);
    setNextLecture(upcoming);
    setAttendance(records);
    setAssignments(work);
    setPayments(paymentRows);
  });

  const currentBatch = enrollments
    .filter((enrollment) => enrollment.status === 'active')
    .sort((a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime())[0]?.batch;

  const attended = attendance.filter((record) => record.status !== 'absent').length;
  const attendanceRate = attendance.length > 0 ? Math.round((attended / attendance.length) * 100) : null;
  // By state, not submitted/not: closed work is not "to hand in".
  const states = assignments.map((item) => assignmentState(item, now));
  const handedIn = states.filter((state) => state === 'done').length;
  const pending = states.filter((state) => state === 'todo').length;
  const missed = states.filter((state) => state === 'missed').length;
  // The balance across every batch, matching the Fees tab exactly. Nothing else
  // about the fee is derived here, because nothing else is shown.
  const outstanding = fees.reduce((sum, fee) => sum + Math.max(0, Number(fee.amount_due)), 0);

  const installment = currentBatch
    ? dueInstallment(
        currentBatch.start_date,
        countInstallmentPayments(payments, currentBatch.id),
        outstanding,
        now,
      )
    : null;

  const name = student?.name ?? user?.full_name ?? 'there';
  const firstName = name.split(' ')[0];

  return (
    <PortalPage
      title={`Hi, ${firstName}`}
      meta={<StudentIdChip code={student?.student_code} />}
      loading={loading}
      error={error}
      onRetry={retry}
    >
      {!studentId ? (
        <PortalEmpty icon={UserPlus}>Student record not linked.</PortalEmpty>
      ) : (
        <>
          <NextUp
            batchName={currentBatch?.name}
            lecture={nextLecture}
            pending={pending}
            outstanding={outstanding}
            installment={installment}
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
              tone={assignments.length === 0 ? 'default' : pending > 0 || missed > 0 ? 'attention' : 'positive'}
              progress={assignments.length > 0 ? (handedIn / assignments.length) * 100 : undefined}
              note={
                assignments.length === 0
                  ? 'Nothing set yet'
                  : pending > 0
                    ? `${pending} to hand in`
                    : missed > 0
                      ? `${missed} missed`
                      : 'All handed in'
              }
            />
            {/* The balance only. What the fee adds up to, and what has been paid
                against it so far, are not the student's number to act on. */}
            <PortalStat
              label="Fees due"
              icon={Wallet}
              value={fees.length === 0 ? 'Not set' : outstanding > 0 ? formatCurrency(outstanding) : 'Nothing'}
              tone={fees.length === 0 ? 'default' : outstanding > 0 ? 'attention' : 'positive'}
              note={
                fees.length === 0
                  ? 'Not set yet'
                  : outstanding > 0
                    ? 'Pay your coordinator'
                    : 'Fully paid up'
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
                    trailing={
                      // While enrolled, the batch's own calendar is what the student cares about.
                      enrollment.status === 'active' && enrollment.batch
                        ? <PortalStatus kind="batch" value={deriveBatchStatus(enrollment.batch)} />
                        : <PortalStatus kind="enrollment" value={enrollment.status} />
                    }
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

/** The one thing worth acting on. A due instalment outranks everything; otherwise class, work, balance. */
function NextUp({
  batchName,
  lecture,
  pending,
  outstanding,
  installment,
  enrolled,
}: {
  batchName?: string;
  lecture: Lecture | null;
  pending: number;
  outstanding: number;
  installment: InstallmentDue | null;
  enrolled: boolean;
}) {
  if (!enrolled) {
    return (
      <PortalFocus icon={UserPlus} title="Not in a batch yet" />
    );
  }

  if (installment) {
    return (
      <PortalFocus
        icon={Wallet}
        tone={installment.missed ? 'attention' : 'default'}
        title={installmentLabel(installment)}
        detail={`Installment ${installment.index} · due ${formatDate(installment.dueDate)}`}
        action={<Link to="/portal/fees" className="portal-focus-link">Details</Link>}
      />
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
