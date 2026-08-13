import { useCallback, useState } from 'react';
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

/**
 * Marking attendance by hand, for the lecture that never produced a Meet export.
 *
 * Deliberately the same shape as the approval table: a roster, a row each, one
 * tick box. Ticking writes the record *and* approves it in one move — there is
 * no half-marked state to come back to, because an admin sitting with the
 * register has already made the judgement the second step would ask for.
 */
export function ManualAttendance({ lectureId, batchId, scheduledMinutes, onChanged }: ManualAttendanceProps) {
  const fullMinutes = scheduledMinutes ?? DEFAULT_LECTURE_MINUTES;

  const [roster, setRoster] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [pending, setPending] = useState<string | null>(null);
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

  const write = async (studentId: string, draft: Draft) => {
    setPending(studentId);
    try {
      const saved = await markAttendance({
        studentId,
        batchId,
        lectureId,
        status: draft.status,
        minutes: draft.minutes,
        source: draft.source,
      });
      if (saved) {
        setRecords((current) => [...current.filter((row) => row.student_id !== studentId), saved]);
      }
      onChanged?.();
    } catch (err) {
      showToast(errorMessage(err, 'Could not mark the attendance'), 'error');
    } finally {
      setPending(null);
    }
  };

  const toggle = async (studentId: string) => {
    const existing = recordFor(studentId);

    if (!existing) {
      await write(studentId, drafts[studentId]);
      return;
    }

    setPending(studentId);
    try {
      await deleteAttendance(existing.id);
      setRecords((current) => current.filter((row) => row.student_id !== studentId));
      onChanged?.();
    } catch (err) {
      showToast(errorMessage(err, 'Could not remove the attendance'), 'error');
    } finally {
      setPending(null);
    }
  };

  // Editing a row that is already marked saves straight away; editing one that is
  // not just prepares what the tick will write.
  const edit = (studentId: string, patch: Partial<Draft>, save: boolean) => {
    const next = { ...drafts[studentId], ...patch };
    setDrafts((current) => ({ ...current, [studentId]: next }));
    if (save && recordFor(studentId)) void write(studentId, next);
  };

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (roster.length === 0) return <EmptyState icon={<Users size={32} />} title="No active students in this batch" />;

  const markedCount = roster.filter((student) => recordFor(student.id)).length;

  return (
    <div className="table-block">
      <div className="table-toolbar">
        <p className="manual-attendance-count">
          {markedCount} of {roster.length} marked
        </p>
        <p className="manual-attendance-note">Ticking a student records and approves in one step.</p>
      </div>

      <Table maxHeight="28rem">
        <THead>
          <TR>
            <TH>Student</TH>
            <TH>Status</TH>
            <TH>Minutes</TH>
            <TH>Source</TH>
            <TH align="center">Marked</TH>
          </TR>
        </THead>
        <TBody>
          {roster.map((student) => {
            const draft = drafts[student.id];
            const marked = Boolean(recordFor(student.id));
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
                  <select
                    className="manual-attendance-field"
                    value={draft.status}
                    onChange={(event) => edit(student.id, { status: event.target.value as AttendanceStatus }, true)}
                    aria-label={`Status for ${student.name}`}
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                </TD>

                <TD>
                  <input
                    type="number"
                    min={0}
                    className="manual-attendance-field is-minutes"
                    value={draft.minutes}
                    onChange={(event) => edit(student.id, { minutes: Number(event.target.value) }, false)}
                    onBlur={() => { if (marked) void write(student.id, draft); }}
                    aria-label={`Minutes for ${student.name}`}
                  />
                </TD>

                <TD>
                  <select
                    className="manual-attendance-field"
                    value={draft.source}
                    onChange={(event) => edit(student.id, { source: event.target.value as AttendanceSource }, true)}
                    aria-label={`Source for ${student.name}`}
                  >
                    {SOURCES.map((source) => (
                      <option key={source} value={source}>{source}</option>
                    ))}
                  </select>
                </TD>

                <TD align="center">
                  <input
                    type="checkbox"
                    className="data-table-checkbox"
                    checked={marked}
                    disabled={pending === student.id}
                    onChange={() => void toggle(student.id)}
                    aria-label={`Mark ${student.name} as attended`}
                  />
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
