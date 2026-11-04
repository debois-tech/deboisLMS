import { useMemo, useState } from 'react';
import { CalendarCheck, ChevronLeft, ChevronRight, Download, Maximize2 } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { PortalStat } from '@/components/portal/PortalStat';
import { ATTENDANCE_PARTIAL_PERCENT, getStudentBatchAttendance } from '@/lib/supabase';
import type { AttendanceRecord } from '@/lib/types';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { downloadCsv, toCsv, toFileStem } from '@/lib/utils/csvExport';
import { WEEKDAY_LABELS, countsFor, formatDateValue, formatMonthLabel, monthGrid, startOfMonth, toDateValue } from '@/lib/utils/date';

type Shown = 'present' | 'partial' | 'absent' | 'no_mark';
const LABEL: Record<Shown, string> = { present: 'Present', partial: 'Partial', absent: 'Absent', no_mark: 'Not marked' };

interface StudentAttendanceProps {
  studentId: string;
  studentName: string;
  batchId: string;
  batchName: string;
  joinedAt: string;
  countEarlier?: boolean;
}

/** The student's attendance in one batch: a summary card, and a popup with the full bar and a calendar. Key it by batch. */
export function StudentAttendance({ studentId, studentName, batchId, batchName, joinedAt, countEarlier }: StudentAttendanceProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [open, setOpen] = useState(false);

  const { loading, error, retry } = useInitialLoad(async () => {
    const all = await getStudentBatchAttendance(studentId, batchId);
    // The same set the student sees: earlier work is left out when the enrolment says so.
    setRecords(all.filter((record) => countsFor(record.lecture?.lecture_date, joinedAt, countEarlier)));
  });

  // Partial is a shade of present: it counts as attended everywhere a number is shown.
  const marked = records.filter((r) => r.status === 'present' || r.status === 'partial' || r.status === 'absent');
  const attended = marked.filter((r) => r.status !== 'absent').length;
  const missed = marked.length - attended;
  const rate = marked.length > 0 ? Math.round((attended / marked.length) * 100) : null;

  // Every lecture the card counts from, oldest first, N/A and Not marked included.
  const exportCsv = () => {
    const when = (record: AttendanceRecord) => new Date(record.lecture?.start_at ?? record.lecture?.lecture_date ?? 0).getTime();
    const rows = [...records].sort((a, b) => when(a) - when(b)).map((record) => [
      formatDateValue(dayOf(record) ?? ''),
      record.lecture?.start_at ? new Date(record.lecture.start_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }) : '',
      record.status === 'no_appli' ? 'N/A' : LABEL[record.status],
      marked.includes(record) ? record.total_attended_minutes : '',
    ]);
    downloadCsv(`${toFileStem(studentName)}-${toFileStem(batchName)}-attendance.csv`, toCsv(['Date', 'Start time', 'Status', 'Minutes'], rows));
  };

  return (
    <>
      <Card padding="sm" className="student-summary-card">
        <div className="flex items-center justify-between gap-2">
          <p className="student-summary-label">Attendance</p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open attendance"
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]"
          >
            <Maximize2 size={14} />
          </button>
        </div>
        {loading ? (
          <p className="student-summary-empty">—</p>
        ) : error ? (
          <p className="student-summary-empty">Could not load</p>
        ) : marked.length === 0 ? (
          <p className="student-summary-empty">No classes yet</p>
        ) : (
          <>
            <p className="student-summary-value">{attended} <span className="student-summary-total">/ {marked.length} lectures</span></p>
            <div className="portal-progress att-progress" role="progressbar" aria-valuenow={rate ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label="Attendance">
              <div className="portal-progress-fill" style={{ transform: `scaleX(${(rate ?? 0) / 100})` }} />
            </div>
          </>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Attendance"
        size="lg"
        footer={
          <Button variant="secondary" className="action-button-compact" onClick={exportCsv} disabled={records.length === 0}>
            <Download size={14} /> Export CSV
          </Button>
        }
      >
        {loading ? (
          <Spinner />
        ) : error ? (
          <ErrorState message={error} onRetry={retry} />
        ) : (
          <div className="att-pop">
            <PortalStat
              label="Attendance"
              icon={CalendarCheck}
              value={rate === null ? 'No classes yet' : `${rate}%`}
              tone={rate === null ? 'default' : rate >= ATTENDANCE_PARTIAL_PERCENT ? 'positive' : 'attention'}
              progress={rate ?? undefined}
              note={
                <>
                  <span className="att-note">{attended} of {marked.length} classes</span>
                  <span className="att-note">Present {attended} · Absent {missed}</span>
                </>
              }
            />
            <AttendanceCalendar records={records} />
          </div>
        )}
      </Modal>
    </>
  );
}

const dayOf = (record: AttendanceRecord) => record.lecture?.lecture_date.slice(0, 10);

/** Opens on today's month. The arrows only reach months that had a lecture; with none, nothing moves. */
function AttendanceCalendar({ records }: { records: AttendanceRecord[] }) {
  const today = toDateValue(new Date());
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  // One dot per lecture, in its status colour. N/A lectures get no dot.
  const dots = useMemo(() => {
    const map = new Map<string, Shown[]>();
    for (const record of records) {
      const day = dayOf(record);
      if (!day || record.status === 'no_appli') continue;
      map.set(day, [...(map.get(day) ?? []), record.status]);
    }
    return map;
  }, [records]);

  const lectureMonths = useMemo(
    () => [...new Set(records.map(dayOf).filter((day): day is string => Boolean(day)).map((day) => day.slice(0, 7)))].sort(),
    [records],
  );

  const here = toDateValue(month).slice(0, 7);
  const before = lectureMonths.filter((key) => key < here).pop();
  const after = lectureMonths.find((key) => key > here);
  const go = (key: string) => setMonth(new Date(`${key}-01T00:00:00`));

  return (
    <div className="calendar att-cal">
      <div className="calendar-head">
        <button type="button" className="calendar-nav" aria-label="Previous lecture month" disabled={!before} onClick={() => before && go(before)}>
          <ChevronLeft size={16} />
        </button>
        <p className="calendar-title">{formatMonthLabel(month)}</p>
        <button type="button" className="calendar-nav" aria-label="Next lecture month" disabled={!after} onClick={() => after && go(after)}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="calendar-grid">
        {monthGrid(month).map((date) => {
          const value = toDateValue(date);
          const inMonth = date.getMonth() === month.getMonth();
          const statuses = inMonth ? dots.get(value) ?? [] : [];
          return (
            <div
              key={value}
              className={clsx('att-cal-day', !inMonth && 'is-outside', value === today && 'is-today')}
              title={statuses.length ? `${formatDateValue(value)}: ${statuses.map((s) => LABEL[s]).join(', ')}` : undefined}
            >
              {date.getDate()}
              {statuses.length > 0 && (
                <span className="att-cal-dots" aria-hidden="true">
                  {statuses.map((status, index) => <span key={index} className={`att-cal-dot is-${status}`} />)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="att-cal-legend">
        {(Object.keys(LABEL) as Shown[]).map((status) => (
          <span key={status}><span className={`att-cal-dot is-${status}`} /> {LABEL[status]}</span>
        ))}
      </div>
    </div>
  );
}
