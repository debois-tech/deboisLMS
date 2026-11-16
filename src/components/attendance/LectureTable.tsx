import { Pencil, Trash2 } from 'lucide-react';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/Table';
import type { LectureAttendanceSummary } from '@/lib/supabase';
import type { Lecture } from '@/lib/types';
import { formatDate, formatDateTime, formatTime } from '@/lib/utils/format';

type Variant = 'lectures' | 'attendance';

interface LectureTableProps {
  lectures: Lecture[];
  summaries: Map<string, LectureAttendanceSummary>;
  /** Lectures lists what was scheduled; attendance lists what was marked. */
  variant: Variant;
  selectedId?: string | null;
  onSelect?: (lecture: Lecture) => void;
  onEdit?: (lecture: Lecture) => void;
  onDelete: (lecture: Lecture) => void;
  deletingId?: string | null;
}

const iconButton =
  'flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--danger-text)] disabled:opacity-50';

// Two emails name the editors; the rest collapse so the cell never becomes a paragraph.
function markedBy(emails: string[] | undefined) {
  if (!emails?.length) return '—';
  const shown = emails.slice(0, 2).join(' · ');
  return emails.length > 2 ? `${shown} …` : shown;
}

/** The batch's lectures, as a table. Shared by the batch-detail Lectures and Attendance rails. */
export function LectureTable({
  lectures,
  summaries,
  variant,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  deletingId,
}: LectureTableProps) {
  const attendance = variant === 'attendance';

  return (
    <Table maxHeight="none">
      <THead>
        <TR>
          <TH>Date</TH>
          {attendance ? (
            <>
              <TH>Tutor</TH>
              <TH>Mode</TH>
            </>
          ) : (
            <>
              <TH>Time</TH>
              <TH>Created</TH>
              <TH>Tutor</TH>
              <TH>Mode</TH>
            </>
          )}
          {attendance && <TH>Attendance</TH>}
          {attendance && <TH>Marked on</TH>}
          {attendance && <TH>Marked by</TH>}
          <TH align="center"><span className="sr-only">Actions</span></TH>
        </TR>
      </THead>
      <TBody>
        {lectures.map((lecture) => {
          const summary = summaries.get(lecture.id);
          const date = formatDate(lecture.lecture_date);
          return (
            <TR
              key={lecture.id}
              className={attendance && selectedId === lecture.id ? 'bg-[var(--primary)]/10' : undefined}
            >
              <TD className="whitespace-nowrap">
                {attendance ? (
                  <button
                    type="button"
                    onClick={() => onSelect?.(lecture)}
                    className="font-medium text-[var(--text-primary)] hover:underline"
                  >
                    {date}
                  </button>
                ) : (
                  <span className="font-medium text-[var(--text-primary)]">{date}</span>
                )}
              </TD>

              {!attendance && (
                <>
                  <TD className="cell-secondary whitespace-nowrap">
                    {lecture.start_at
                      ? `${formatTime(lecture.start_at)}${lecture.end_at ? ` – ${formatTime(lecture.end_at)}` : ''}`
                      : `${lecture.scheduled_duration_minutes ?? 120} min`}
                  </TD>
                  <TD className="cell-muted whitespace-nowrap">{formatDate(lecture.created_at)}</TD>
                </>
              )}

              <TD className="cell-secondary whitespace-nowrap">{lecture.tutor?.name ?? '—'}</TD>

              <TD className="cell-muted capitalize">{lecture.session_type}</TD>

              {attendance && (
                <>
                  <TD className="cell-secondary whitespace-nowrap">
                    {summary ? `${summary.attended}/${summary.applicable}` : '—'}
                  </TD>
                  <TD className="cell-secondary whitespace-nowrap">
                    {summary?.marked_at ? formatDateTime(summary.marked_at) : '—'}
                  </TD>
                  <TD className="cell-muted" title={summary?.marked_by?.join(', ') || undefined}>
                    {markedBy(summary?.marked_by)}
                  </TD>
                </>
              )}

              <TD align="center" className="whitespace-nowrap">
                <div className="flex items-center justify-center gap-1">
                  {onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(lecture)}
                      aria-label={`Edit the lecture on ${date}`}
                      className={iconButton}
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(lecture)}
                    disabled={deletingId === lecture.id}
                    aria-label={`Delete the lecture on ${date}`}
                    className={iconButton}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
