import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Layers, CalendarDays, History, Edit3, ExternalLink, UserMinus } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotFound } from '@/components/ui/NotFound';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { StudentLoginCard } from '@/components/students/StudentLoginCard';
import { StudentIdChip } from '@/components/students/StudentLink';
import { getStudentById, getStudentBatches, getFeesByStudent, getLecturesByBatch, getFeePaymentLogsByStudent, terminateEnrolment } from '@/lib/supabase';
import type { Student, BatchStudentMapping, Batch, StudentFee, Lecture, FeePaymentLog } from '@/lib/types';
import { formatDate, formatCurrency } from '@/lib/utils/format';
import { useToast } from '@/lib/context/ToastContext';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { errorMessage } from '@/lib/utils/errors';

export default function StudentDetailPage() {
  const { studentId } = useParams();
  const [student, setStudent] = useState<Student | null>(null);
  const [batchMappings, setBatchMappings] = useState<(BatchStudentMapping & { batch?: Batch })[]>([]);
  const [currentFee, setCurrentFee] = useState<StudentFee | null>(null);
  const [nextLecture, setNextLecture] = useState<Lecture | null>(null);
  const [paymentLogs, setPaymentLogs] = useState<FeePaymentLog[]>([]);
  const [terminating, setTerminating] = useState(false);
  const { showToast } = useToast();
  const confirm = useConfirm();

  const { loading, error, retry } = useInitialLoad(async () => {
    if (!studentId) return;

    const [s, mappings, logs] = await Promise.all([
      getStudentById(studentId),
      getStudentBatches(studentId),
      getFeePaymentLogsByStudent(studentId),
    ]);
    setStudent(s ?? null);
    setPaymentLogs(logs);
    setBatchMappings(mappings);

    // Multiple active batches are possible; the most recently joined one is "current".
    const activeMappings = mappings.filter((m) => m.status === 'active');
    const currentMapping = activeMappings.sort(
      (a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime()
    )[0];

    if (currentMapping) {
      const [fees, lectures] = await Promise.all([
        getFeesByStudent(studentId),
        getLecturesByBatch(currentMapping.batch_id),
      ]);
      setCurrentFee(fees.find((f) => f.batch_id === currentMapping.batch_id) ?? null);

      const today = new Date().toISOString().slice(0, 10);
      const upcoming = lectures
        .filter((l) => l.lecture_date.slice(0, 10) >= today)
        .sort((a, b) => a.lecture_date.localeCompare(b.lecture_date))[0];
      setNextLecture(upcoming ?? null);
    }
  });

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;
  if (!student) return <NotFound label="Student" />;

  const activeMappings = batchMappings.filter((m) => m.status === 'active');
  const currentMapping = activeMappings.sort(
    (a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime()
  )[0];
  const currentBatch = currentMapping?.batch;

  // Terminates the current enrolment only. The batch is named in the dialog so
  // there is no doubt which one when a student sits on more than one.
  const handleTerminate = async () => {
    if (!currentMapping) return;
    const ok = await confirm({
      title: `Terminate ${student.name}?`,
      message: `Leaving ${currentBatch?.name ?? 'this batch'}. Any instalment already due is settled and their login is deleted. Records stay.`,
      confirmLabel: 'Terminate',
      danger: true,
    });
    if (!ok) return;

    setTerminating(true);
    try {
      const result = await terminateEnrolment(currentMapping.id);
      showToast(
        result.void_amount > 0
          ? `Terminated — ${formatCurrency(result.void_amount)} void`
          : 'Terminated',
      );
      retry();
    } catch (err) {
      showToast(errorMessage(err, 'Could not terminate this student'), 'error');
    } finally {
      setTerminating(false);
    }
  };

  const batchNameById = new Map(batchMappings.map((m) => [m.batch_id, m.batch?.name ?? m.batch_id]));

  // Only what this student actually has — an empty row says nothing worth a line.
  const profileFacts = [
    { label: 'Date of Birth', value: student.date_of_birth ? formatDate(student.date_of_birth) : '' },
    { label: 'Gender', value: student.gender ?? '' },
    { label: 'College', value: student.college ?? '' },
    { label: 'Course', value: student.course ?? '' },
    { label: 'Branch', value: student.branch ?? '' },
    { label: 'Current Year', value: student.current_year ?? '' },
    { label: 'Graduation Year', value: student.graduation_year ? String(student.graduation_year) : '' },
  ].filter((fact) => fact.value);

  return (
    <div className="page-section">
      <div className="detail-topbar">
        <Link to="/students" className="detail-back-link">
          <ArrowLeft size={14} /> Back to Students
        </Link>
        <div className="flex items-center gap-2">
          <Link to={`/students/${student.id}/edit`}>
            <Button variant="outline" className="action-button-compact"><Edit3 size={14} /> Edit</Button>
          </Link>
          {currentMapping && (
            <Button
              variant="outline"
              className="action-button-compact action-button-danger"
              onClick={handleTerminate}
              loading={terminating}
            >
              <UserMinus size={14} /> Terminate
            </Button>
          )}
        </div>
      </div>

      <Card padding="lg">
        <div className="student-identity-row">
          <div className="student-avatar">
            {student.name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
          </div>
          <div className="student-identity min-w-0 flex-1">
            <div className="student-identity-name">
              <h1 className="student-identity-title">{student.name}</h1>
              <StudentIdChip code={student.student_code} showLabel={false} />
            </div>
            <div className="student-identity-meta">
              {student.email && (
                <span className="flex min-w-0 items-center gap-1.5"><Mail size={14} className="shrink-0" /> <span className="break-all">{student.email}</span></span>
              )}
              {student.phone && (
                <span className="flex items-center gap-1.5"><Phone size={14} className="shrink-0" /> {student.phone}</span>
              )}
            </div>
          </div>
          {(student.github_url || student.linkedin_url) && (
            <div className="student-identity-links">
              {student.github_url && (
                <a href={student.github_url} target="_blank" rel="noreferrer" className="student-link-chip">
                  GitHub <ExternalLink size={12} className="shrink-0" />
                </a>
              )}
              {student.linkedin_url && (
                <a href={student.linkedin_url} target="_blank" rel="noreferrer" className="student-link-chip">
                  LinkedIn <ExternalLink size={12} className="shrink-0" />
                </a>
              )}
            </div>
          )}
        </div>
      </Card>

      <div className="student-summary-grid">
        <Card padding="sm" className="student-summary-card">
          <p className="student-summary-label">Current Batch</p>
          {currentBatch ? (
            <Link to={`/batches/${currentBatch.id}`} className="student-summary-value student-summary-link">
              {currentBatch.name}
            </Link>
          ) : (
            <p className="student-summary-empty">No current batch</p>
          )}
        </Card>
        <Card padding="sm" className="student-summary-card">
          <p className="student-summary-label">Total Payment</p>
          {currentBatch && currentFee ? (
            <div className="student-summary-payment">
              <p className="student-summary-value">{formatCurrency(currentFee.paid_amount)} <span className="student-summary-total">/ {formatCurrency(currentFee.total_fee)}</span></p>
              <p className={`student-summary-status ${currentFee.total_fee - currentFee.paid_amount > 0 ? 'is-due' : 'is-paid'}`}>
                {currentFee.total_fee - currentFee.paid_amount > 0 ? `${formatCurrency(currentFee.total_fee - currentFee.paid_amount)} due` : 'Paid in full'}
              </p>
            </div>
          ) : (
            <p className="student-summary-empty">—</p>
          )}
        </Card>
        <Card padding="sm" className="student-summary-card">
          <p className="student-summary-label">Next Lecture</p>
          {currentBatch && nextLecture ? (
            <div className="student-summary-lecture">
              <p className="student-summary-value">{formatDate(nextLecture.lecture_date)}</p>
              <p className="student-summary-meta">
                {nextLecture.session_type}{nextLecture.meeting_code ? ` • ${nextLecture.meeting_code}` : ''}
              </p>
            </div>
          ) : (
            <p className="student-summary-empty">{currentBatch ? 'All lectures up to date' : '—'}</p>
          )}
        </Card>
      </div>

      {profileFacts.length > 0 && (
        <Card>
          <CardHeader title="Profile" />
          <dl className="student-facts">
            {profileFacts.map(({ label, value }) => (
              <div key={label} className="min-w-0">
                <dt className="student-fact-label">{label}</dt>
                <dd className="student-fact-value">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      <Card className="portal-login-card">
        <CardHeader title="Portal Login" className="portal-login-header" />
        <StudentLoginCard
          studentId={student.id}
          email={student.email}
          phone={student.phone}
          hasLogin={Boolean(student.auth_user_id)}
          passwordRotated={student.password_rotated}
          onCreated={() => getStudentById(student.id).then((s) => setStudent(s ?? student))}
        />
      </Card>

      <Card>
        <CardHeader title="Batch History" />
        {batchMappings.length === 0 ? (
          <EmptyState icon={<Layers size={32} />} title="Not enrolled in any batches" />
        ) : (
          <div className="batch-list">
            {batchMappings.map((m) => (
              <Link
                key={m.id}
                to={`/batches/${m.batch_id}`}
                className="batch-list-item flex items-center justify-between gap-4 hover:bg-[var(--bg-elevated)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Layers size={18} className="shrink-0 text-[var(--primary)]" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{m.batch?.name ?? m.batch_id}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]"><CalendarDays size={12} /> Joined {formatDate(m.joined_at)}</p>
                  </div>
                </div>
                <StatusPill kind="enrollment" value={m.status} />
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Payment Logs" />
        {paymentLogs.length === 0 ? (
          <EmptyState icon={<History size={32} />} title="No payment logs yet" />
        ) : (
          <Table maxHeight="24rem">
            <THead>
              <TR>
                <TH>Amount</TH>
                <TH>Date</TH>
                <TH>Batch</TH>
                <TH>Method</TH>
                <TH>Notes</TH>
              </TR>
            </THead>
            <TBody>
              {paymentLogs.map((log) => (
                <TR key={log.id}>
                  <TD className="font-semibold text-[var(--success-text)]">{formatCurrency(Number(log.amount))}</TD>
                  <TD className="cell-secondary">{log.payment_date}</TD>
                  <TD className="cell-secondary">{batchNameById.get(log.batch_id) ?? log.batch_id}</TD>
                  <TD className="cell-muted capitalize">{(log.payment_method ?? '—').replace('_', ' ')}</TD>
                  <TD className="cell-muted">{log.notes || '—'}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
