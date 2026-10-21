import { useCallback, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { StudentLink } from '@/components/students/StudentLink';
import { deleteAttendance, getAttendanceByLecture, getBatchStudents, markAttendance } from '@/lib/supabase';
import type { AttendanceRecord, AttendanceSource, AttendanceStatus, BatchStudentMapping, Student } from '@/lib/types';
import { DEFAULT_LECTURE_MINUTES } from '@/lib/attendance/types';
import { useToast } from '@/lib/context/ToastContext';
import { errorMessage } from '@/lib/utils/errors';
import { useReloadableSection } from '@/lib/hooks/useInitialLoad';

const STATUSES: AttendanceStatus[] = ['present', 'partial', 'absent'];
const STATUS_LABEL: Record<AttendanceStatus, string> = { present: 'Present', partial: 'Partial', absent: 'Absent' };
const SOURCES: AttendanceSource[] = ['manual', 'automated'];

interface Draft {
  status: AttendanceStatus;
  minutes: number;
  source: AttendanceSource;
}

interface ManualAttendanceProps {
  lectureId: string;
  batchId: string;
  /** The lecture's scheduled length, which is what a full attendance is worth. */
  scheduledMinutes?: number;
  /** Fired after any write, so the page's own records list can refetch. */
  onChanged?: () => void;
}

/** Marking attendance by hand. Ticking writes and approves at once — the admin already judged. */
export function ManualAttendance({ lectureId, batchId, scheduledMinutes, onChanged }: ManualAttendanceProps) {
  const fullMinutes = scheduledMinutes ?? DEFAULT_LECTURE_MINUTES;

  const [roster, setRoster] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  // Per student, not one shared slot: a second click elsewhere must not re-enable a row whose write is still in flight.
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set());
  const inFlight = useRef(new Set<string>());
  const { showToast } = useToast();

  const load = useCallback(async () => {
    const [students, existing] = await Promise.all([
      getBatchStudents(batchId),
      getAttendanceByLecture(lectureId),
    ]);

    const active = students.filter((student) => student.mapping.status === 'active');
    setRoster(active);
    setRecords(existing);

    // A student already on the register keeps their recorded values; everyone
    // else starts at a full, present attendance, which is the common case.
    setDrafts(
      Object.fromEntries(
        active.map((student) => {
          const record = existing.find((row) => row.student_id === student.id);
          return [
            student.id,
            {
              status: record?.status ?? 'present',
              minutes: Number(record?.total_attended_minutes ?? fullMinutes),
              source: record?.source ?? 'manual',
            } satisfies Draft,
          ];
        }),
      ),
    );
  }, [batchId, lectureId, fullMinutes]);

  const { error, reload } = useReloadableSection(load);

  const recordFor = (studentId: string) => records.find((row) => row.student_id === studentId);

  /** Claims a student's row for one request; false when another is already running for them. */
  const begin = (studentId: string) => {
    if (inFlight.current.has(studentId)) return false;
    inFlight.current.add(studentId);
    setPending(new Set(inFlight.current));
    return true;
  };

  const finish = (studentId: string) => {
    inFlight.current.delete(studentId);
    setPending(new Set(inFlight.current));
  };

  // `approved` is the state the row should end in. An edit passes the row's current one, so changing
  // a pending record's minutes does not quietly approve it.
  const write = async (studentId: string, draft: Draft, approved: boolean) => {
    if (!begin(studentId)) return;
    try {
      const saved = await markAttendance({
        studentId,
        batchId,
        lectureId,
        status: draft.status,
        minutes: draft.minutes,
        source: draft.source,
        approved,
      });
      if (saved) {
        setRecords((current) => [...current.filter((row) => row.student_id !== studentId), saved]);
      }
      onChanged?.();
    } catch (err) {
      showToast(errorMessage(err, 'Could not mark the attendance'), 'error');
    } finally {
      finish(studentId);
    }
  };

  // A capsule is the judgement: it records that status and approves it. Pressing the status a student
  // already has, once approved, takes them off the register again.
  const chooseStatus = async (studentId: string, status: AttendanceStatus) => {
    const existing = recordFor(studentId);

    if (!existing || existing.status !== status || !existing.approved) {
      const next = { ...drafts[studentId], status };
      setDrafts((current) => ({ ...current, [studentId]: next }));
      await write(studentId, next, true);
      return;
    }

    if (!begin(studentId)) return;
    try {
      await deleteAttendance(existing.id);
      setRecords((current) => current.filter((row) => row.student_id !== studentId));
      onChanged?.();
    } catch (err) {
      showToast(errorMessage(err, 'Could not remove the attendance'), 'error');
    } finally {
      finish(studentId);
    }
  };

  // Editing a row that is already on the register saves straight away; editing one that is
  // not just prepares what the next capsule press will write.
  const edit = (studentId: string, patch: Partial<Draft>, save: boolean) => {
    const next = { ...drafts[studentId], ...patch };
    setDrafts((current) => ({ ...current, [studentId]: next }));
    const existing = recordFor(studentId);
    if (save && existing) void write(studentId, next, Boolean(existing.approved));
  };

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (roster.length === 0) return <EmptyState icon={<Users size={32} />} title="No active students in this batch" />;

  const markedCount = roster.filter((student) => recordFor(student.id)?.approved).length;

  return (
    <div className="table-block">
      <div className="table-toolbar">
        <p className="manual-attendance-count">
          {markedCount} of {roster.length} marked
        </p>
        <p className="manual-attendance-note">Choosing a status records and approves it in one step.</p>
      </div>

      <Table maxHeight="28rem">
        <THead>
          <TR>
            <TH>Student</TH>
            <TH>Minutes</TH>
            <TH>Status</TH>
            <TH>Source</TH>
          </TR>
        </THead>
        <TBody>
          {roster.map((student) => {
            const draft = drafts[student.id];
            const record = recordFor(student.id);
            const busy = pending.has(student.id);
            if (!draft) return null;

            return (
              <TR key={student.id}>
                <TD>
                  <p className="font-medium text-[var(--text-primary)]">
                    <StudentLink studentId={student.id} name={student.name} />
                  </p>
                  {student.student_code && (
                    <p className="cell-muted mt-0.5 text-xs font-mono">{student.student_code}</p>
                  )}
                </TD>

                <TD>
                  <input
                    type="number"
                    min={0}
                    className="manual-attendance-field is-minutes"
                    value={draft.minutes}
                    onChange={(event) => edit(student.id, { minutes: Number(event.target.value) }, false)}
                    onBlur={() => { if (record) void write(student.id, draft, Boolean(record.approved)); }}
                    aria-label={`Minutes for ${student.name}`}
                  />
                </TD>

                <TD>
                  <div className="attendance-capsules" role="group" aria-label={`Status for ${student.name}`}>
                    {STATUSES.map((status) => (
                      <button
                        key={status}
                        type="button"
                        className={`attendance-capsule is-${status}`}
                        // A pending record reads as chosen too, but only an approved one counts as marked.
                        aria-pressed={record?.status === status}
                        data-pending={record?.status === status && !record.approved ? 'true' : undefined}
                        disabled={busy}
                        onClick={() => void chooseStatus(student.id, status)}
                      >
                        {STATUS_LABEL[status]}
                      </button>
                    ))}
                  </div>
                </TD>

                <TD>
                  <select
                    className="manual-attendance-field"
                    value={draft.source}
                    disabled={busy}
                    onChange={(event) => edit(student.id, { source: event.target.value as AttendanceSource }, true)}
                    aria-label={`Source for ${student.name}`}
                  >
                    {SOURCES.map((source) => (
                      <option key={source} value={source}>{source}</option>
                    ))}
                  </select>
                </TD>

              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
