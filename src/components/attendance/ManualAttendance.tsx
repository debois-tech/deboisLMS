import { useCallback, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { StatusPill } from '@/components/ui/StatusPill';
import { StudentLink } from '@/components/students/StudentLink';
import { ATTENDANCE_PARTIAL_PERCENT, getAttendanceByLecture, getBatchStudents, saveAttendance } from '@/lib/supabase';
import type { AttendanceRecord, AttendanceStatus, BatchStudentMapping, Student } from '@/lib/types';
import { DEFAULT_LECTURE_MINUTES } from '@/lib/attendance/types';
import { useToast } from '@/lib/context/ToastContext';
import { errorMessage } from '@/lib/utils/errors';
import { useInFlight, useReloadableSection } from '@/lib/hooks/useInitialLoad';

type Mark = 'present' | 'partial' | 'absent';
const MARKS: Mark[] = ['present', 'partial', 'absent'];
const MARK_LABEL: Record<Mark, string> = { present: 'Present', partial: 'Partial', absent: 'Absent' };

// A pill fills the minutes it stands for: the whole lecture, the partial band's floor, none.
const minutesFor = (mark: Mark, full: number) =>
  mark === 'present' ? full : mark === 'partial' ? Math.round((full * ATTENDANCE_PARTIAL_PERCENT) / 100) : 0;

const isMark = (status: AttendanceStatus | null): status is Mark => status === 'present' || status === 'partial' || status === 'absent';

/** `status` is null until a pill is chosen; a saved N/A stays `no_appli` and is not a gap. */
interface Draft {
  status: AttendanceStatus | null;
  minutes: number;
}

interface ManualAttendanceProps {
  lectureId: string;
  batchId: string;
  /** The lecture's scheduled length, which is what a full attendance is worth. */
  scheduledMinutes?: number;
  /** Fired once the marks are saved. */
  onSaved?: () => void;
}

/** Marking a lecture by hand. Pills only change the screen; Save writes the whole lecture at once. */
export function ManualAttendance({ lectureId, batchId, scheduledMinutes, onSaved }: ManualAttendanceProps) {
  const full = scheduledMinutes ?? DEFAULT_LECTURE_MINUTES;

  const [roster, setRoster] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [showGaps, setShowGaps] = useState(false);
  const nameRefs = useRef(new Map<string, HTMLElement>());
  const { busy, begin, finish } = useInFlight();
  const saving = busy.has('save');
  const { showToast } = useToast();

  const load = useCallback(async () => {
    const [students, existing] = await Promise.all([getBatchStudents(batchId), getAttendanceByLecture(lectureId)]);

    const active = students.filter((student) => student.mapping.status === 'active');
    setRoster(active);
    setRecords(existing);
    setShowGaps(false);

    // A saved mark keeps its values; a student nobody has marked starts with no pill chosen.
    setDrafts(
      Object.fromEntries(
        active.map((student) => {
          const record = existing.find((row) => row.student_id === student.id);
          const status = !record || record.status === 'no_mark' ? null : record.status;
          const minutes = record?.total_attended_minutes != null ? Number(record.total_attended_minutes) : isMark(status) ? minutesFor(status, full) : 0;
          return [student.id, { status, minutes } satisfies Draft];
        }),
      ),
    );
  }, [batchId, lectureId, full]);

  const { error, reload } = useReloadableSection(load);

  const pick = (studentId: string, mark: Mark) =>
    setDrafts((current) => ({ ...current, [studentId]: { status: mark, minutes: minutesFor(mark, full) } }));

  // Only what a person changed is written; untouched CSV rows keep their source.
  const changed = (studentId: string) => {
    const draft = drafts[studentId];
    const record = records.find((row) => row.student_id === studentId);
    return isMark(draft.status) && (!record || record.status !== draft.status || Number(record.total_attended_minutes ?? -1) !== draft.minutes);
  };

  const save = async () => {
    const gaps = roster.filter((student) => drafts[student.id]?.status === null);
    if (gaps.length > 0) {
      setShowGaps(true);
      nameRefs.current.get(gaps[0].id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!begin('save')) return;
    try {
      const marks = roster
        .filter((student) => changed(student.id))
        .map((student) => ({ studentId: student.id, status: drafts[student.id].status as Mark, minutes: drafts[student.id].minutes, source: 'manual' as const }));
      await saveAttendance(batchId, lectureId, marks);
      showToast('Attendance saved');
      onSaved?.();
    } catch (err) {
      showToast(errorMessage(err, 'Could not save the attendance'), 'error');
    } finally {
      finish('save');
    }
  };

  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (roster.length === 0) return <EmptyState icon={<Users size={32} />} title="No active students in this batch" />;

  const markedCount = roster.filter((student) => drafts[student.id]?.status !== null).length;

  return (
    <div className="table-block">
      <div className="table-toolbar">
        <p className="manual-attendance-count">
          {markedCount} of {roster.length} marked
        </p>
        <Button size="sm" className="action-button-compact" onClick={() => void save()} loading={saving}>
          Save
        </Button>
      </div>

      <Table maxHeight="28rem">
        <THead>
          <TR>
            <TH>Student</TH>
            <TH>Minutes</TH>
            <TH>Status</TH>
          </TR>
        </THead>
        <TBody>
          {roster.map((student) => {
            const draft = drafts[student.id];
            if (!draft) return null;
            const gap = showGaps && draft.status === null;

            return (
              <TR key={student.id} className={gap ? 'attendance-gap' : undefined}>
                <TD>
                  <p
                    className="font-medium text-[var(--text-primary)]"
                    ref={(element) => {
                      if (element) nameRefs.current.set(student.id, element);
                      else nameRefs.current.delete(student.id);
                    }}
                  >
                    <StudentLink studentId={student.id} name={student.name} />
                  </p>
                  {student.student_code && <p className="cell-muted text-xs font-mono">{student.student_code}</p>}
                  {gap && <p className="attendance-gap-hint">Mark attendance</p>}
                </TD>

                <TD className="cell-secondary">{draft.status === null || draft.status === 'no_appli' ? '—' : `${draft.minutes} min`}</TD>

                <TD>
                  <div className="attendance-capsules" role="group" aria-label={`Status for ${student.name}`}>
                    {MARKS.map((mark) => (
                      <button
                        key={mark}
                        type="button"
                        className={`attendance-capsule is-${mark}`}
                        aria-pressed={draft.status === mark}
                        disabled={saving}
                        onClick={() => pick(student.id, mark)}
                      >
                        {MARK_LABEL[mark]}
                      </button>
                    ))}
                    {draft.status === 'no_appli' && <StatusPill kind="attendance" value="no_appli" />}
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
