import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Download, ExternalLink, Users, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { getAssignmentSubmissions, markSubmission } from '@/lib/supabase';
import type { AssignmentSubmissionRow } from '@/lib/supabase';
import { formatDateTime } from '@/lib/utils/format';
import { downloadCsv, toCsv, toFileStem } from '@/lib/utils/csvExport';
import { useToast } from '@/lib/context/ToastContext';
import { errorMessage } from '@/lib/utils/errors';

interface AssignmentSubmissionTableProps {
  assignmentId: string;
  batchId: string;
  /** Names the CSV file, so the admin can tell exports apart after downloading. */
  assignmentTitle: string;
}

const CSV_HEADERS = ['Student Name', 'Submitted', 'GitHub Repo', 'Submitted At'];

/**
 * Per-assignment submission roster: every actively enrolled student, whether they
 * have submitted, the repo they submit from, and when. Shared by the Assignments
 * page and the batch detail tab so the two can't drift apart.
 */
export function AssignmentSubmissionTable({
  assignmentId,
  batchId,
  assignmentTitle,
}: AssignmentSubmissionTableProps) {
  const [rows, setRows] = useState<AssignmentSubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);
  const { showToast } = useToast();

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    getAssignmentSubmissions(assignmentId, batchId)
      .then((data) => {
        if (active) setRows(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [assignmentId, batchId]);

  useEffect(load, [load]);

  const handleToggle = async (row: AssignmentSubmissionRow) => {
    setBusyStudentId(row.student_id);
    try {
      await markSubmission(assignmentId, row.student_id, !row.submitted);
      const data = await getAssignmentSubmissions(assignmentId, batchId);
      setRows(data);
    } catch (error) {
      showToast(errorMessage(error, 'Failed to update submission'), 'error');
    } finally {
      setBusyStudentId(null);
    }
  };

  // Same four columns as the table, and the same rendered values — the file the
  // admin shares always matches what they were looking at.
  const handleExport = () => {
    const csv = toCsv(
      CSV_HEADERS,
      rows.map((row) => [
        row.student_name,
        row.submitted ? 'Yes' : 'No',
        row.repo_url ?? '',
        row.submitted_at ? formatDateTime(row.submitted_at) : '',
      ]),
    );
    downloadCsv(`${toFileStem(assignmentTitle)}-submissions.csv`, csv);
    showToast('CSV downloaded');
  };

  const submittedCount = rows.filter((row) => row.submitted).length;

  return (
    <div className="table-block">
      <div className="table-toolbar">
        <Badge variant={submittedCount === rows.length && rows.length > 0 ? 'success' : 'default'}>
          {submittedCount} of {rows.length} submitted
        </Badge>
        <Button
          size="sm"
          variant="secondary"
          className="action-button-compact"
          onClick={handleExport}
          disabled={loading || rows.length === 0}
        >
          <Download size={14} /> Export CSV
        </Button>
      </div>

      {loading ? (
        <Spinner centered />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Users size={32} />} title="No active students in this batch" />
      ) : (
        <Table maxHeight="24rem">
          <THead>
            <TR>
              <TH>Student</TH>
              <TH align="center">Submitted</TH>
              <TH>GitHub Repo</TH>
              <TH>Submitted At</TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((row) => (
              <TR key={row.student_id}>
                <TD className="font-medium text-[var(--text-primary)]">{row.student_name}</TD>
                <TD align="center">
                  <button
                    type="button"
                    onClick={() => handleToggle(row)}
                    disabled={busyStudentId === row.student_id}
                    aria-pressed={row.submitted}
                    aria-label={`${row.submitted ? 'Unmark' : 'Mark'} ${row.student_name} as submitted`}
                    className={`submission-toggle ${row.submitted ? 'is-submitted' : ''}`}
                  >
                    {row.submitted ? <CheckCircle size={20} /> : <XCircle size={20} />}
                  </button>
                </TD>
                <TD>
                  {row.repo_url ? (
                    <div className="repo-field">
                      <div className="repo-field-scroll">
                        <a href={row.repo_url} target="_blank" rel="noreferrer" className="repo-field-link">
                          {row.repo_url}
                        </a>
                      </div>
                      <a
                        href={row.repo_url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${row.student_name}'s repo in a new tab`}
                        className="repo-field-open"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  ) : (
                    <span className="cell-muted text-xs">Not shared yet</span>
                  )}
                </TD>
                <TD className="cell-secondary text-xs whitespace-nowrap">
                  {row.submitted_at ? formatDateTime(row.submitted_at) : '—'}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
