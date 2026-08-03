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
  getApprovedAttendanceByStudent,
  getAssignmentsForStudent,
  getBatchById,
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
  const [currentFee, setCurrentFee] = useState<StudentFee | null>(null);
  const [nextLecture, setNextLecture] = useState<Lecture | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    let active = true;

    (async () => {
      const [record, mappings, records, work] = await Promise.all([
        getStudentById(studentId),
        getStudentBatches(studentId),
        getApprovedAttendanceByStudent(studentId),
        getAssignmentsForStudent(studentId),
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
  const outstanding = currentFee ? Number(currentFee.total_fee) - Number(currentFee.paid_amount) : 0;

  const name = student?.name ?? user?.full_name ?? 'there';
  const firstName = name.split(' ')[0];

  return (
    <PortalPage title={`Hi, ${firstName}`} loading={loading}>
      {!studentId ? (
        <PortalEmpty icon={UserPlus}>
          This login isn't linked to your student record yet. Ask your coordinator.
        </PortalEmpty>
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
              label="Classes"
              icon={CalendarCheck}
              value={attendanceRate === null ? 'Not started' : `${attendanceRate}%`}
              tone={attendanceRate === null ? 'default' : attendanceRate >= 75 ? 'positive' : 'attention'}
              progress={attendanceRate ?? undefined}
              note={
                attendance.length > 0
                  ? `${attended} of ${attendance.length} classes`
                  : 'Counted once marked'
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
              value={!currentFee ? 'Not set' : outstanding > 0 ? formatCurrency(outstanding) : 'All paid'}
              tone={!currentFee ? 'default' : outstanding > 0 ? 'attention' : 'positive'}
              note={
                !currentFee
                  ? 'Not set yet'
                  : outstanding > 0
                    ? `of ${formatCurrency(Number(currentFee.total_fee))} total`
                    : `${formatCurrency(Number(currentFee.total_fee))} paid`
              }
            />
          </PortalStatGrid>

          <PortalSection title="Your batches">
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
      <PortalFocus
        icon={UserPlus}
        title="Not in a batch yet"
        detail="Your coordinator will add you."
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
        title={`${formatCurrency(outstanding)} fee still to pay`}
        action={<Link to="/portal/fees" className="portal-focus-link">Details</Link>}
      />
    );
  }

  return <PortalFocus icon={PartyPopper} title="All caught up" />;
}
