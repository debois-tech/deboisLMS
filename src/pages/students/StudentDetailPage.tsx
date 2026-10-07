import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { BackLink } from '@/components/ui/BackLink';
import { Mail, Phone, Layers, CalendarDays, History, Edit3, ExternalLink, UserMinus, Trash2, Pencil } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { EnrolmentSelect } from '@/components/ui/BatchSelect';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyState } from '@/components/ui/EmptyState';
import { NotFound } from '@/components/ui/NotFound';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { StudentLoginCard } from '@/components/students/StudentLoginCard';
import { StudentIdChip } from '@/components/students/StudentLink';
import { Badge } from '@/components/ui/Badge';
import { ClaimActions } from '@/components/finance/ClaimActions';
import { getStudentById, getStudentBatches, getFeesByStudent, getLecturesByBatch, getFeePaymentLogsByStudent, getPendingClaims, terminateEnrolment, setStudentFee, getStudentDeletionCounts, deleteStudent } from '@/lib/supabase';
import type { StudentDeletionCounts } from '@/lib/supabase';
import type { Student, BatchStudentMapping, Batch, StudentFee, Lecture, FeePaymentLog, PaymentClaim } from '@/lib/types';
import { formatDate, formatCurrency } from '@/lib/utils/format';
import { useToast } from '@/lib/context/ToastContext';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { errorMessage } from '@/lib/utils/errors';

const DELETION_LABELS: [keyof StudentDeletionCounts, string][] = [
  ['batches', 'Enrolments'],
  ['fees', 'Fee records'],
  ['payments', 'Payment logs'],
  ['attendance', 'Attendance records'],
  ['submissions', 'Assignment submissions'],
  ['badges', 'Badges earned'],
  ['claims', 'Payment claims'],
];

export default function StudentDetailPage() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [batchMappings, setBatchMappings] = useState<(BatchStudentMapping & { batch?: Batch })[]>([]);
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [nextLectures, setNextLectures] = useState<Record<string, Lecture | undefined>>({});
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [paymentLogs, setPaymentLogs] = useState<FeePaymentLog[]>([]);
  const [claims, setClaims] = useState<PaymentClaim[]>([]);
  const [terminating, setTerminating] = useState(false);
  // The fee being typed, or null when the fee is not being edited.
  const [feeDraft, setFeeDraft] = useState<string | null>(null);
  const [savingFee, setSavingFee] = useState(false);
  const { showToast } = useToast();
  const confirm = useConfirm();

  const { loading, error, retry } = useInitialLoad(async () => {
    if (!studentId) return;

    const [s, mappings, logs, pending, allFees] = await Promise.all([
      getStudentById(studentId),
      getStudentBatches(studentId),
      getFeePaymentLogsByStudent(studentId),
      getPendingClaims(studentId),
      getFeesByStudent(studentId),
    ]);
    setStudent(s ?? null);
    setPaymentLogs(logs);
    setClaims(pending);
    setBatchMappings(mappings);
    setFees(allFees);

    // Only a live enrolment has a next lecture.
    const live = mappings.filter((m) => m.status === 'active');
    const lectureSets = await Promise.all(live.map((m) => getLecturesByBatch(m.batch_id)));
    const today = new Date().toISOString().slice(0, 10);
    setNextLectures(Object.fromEntries(live.map((m, i) => [
      m.batch_id,
      lectureSets[i]
        .filter((l) => l.lecture_date.slice(0, 10) >= today)
        .sort((a, b) => a.lecture_date.localeCompare(b.lecture_date))[0],
    ])));
  });

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;
  if (!student) return <NotFound label="Student" />;

  // Default is the most recently joined live batch, else the latest of any status.
  const newestFirst = [...batchMappings].sort(
    (a, b) => new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime()
  );
  const currentMapping =
    batchMappings.find((m) => m.batch_id === selectedBatchId)
    ?? newestFirst.find((m) => m.status === 'active')
    ?? newestFirst[0];
  const currentBatch = currentMapping?.batch;
  const isActive = currentMapping?.status === 'active';
  const currentFee = fees.find((f) => f.batch_id === currentMapping?.batch_id) ?? null;
  const nextLecture = currentMapping ? nextLectures[currentMapping.batch_id] : undefined;
  // A leaver owes their void, not the rest of the fee.
  const left = currentFee?.status === 'terminated';
  const owed = currentFee ? Math.max((left ? Number(currentFee.expected_on_exit) : currentFee.total_fee) - currentFee.paid_amount, 0) : 0;

  // Terminates the current enrolment only. The batch is named in the dialog so
  // there is no doubt which one when a student sits on more than one.
  const handleTerminate = async () => {
    if (!currentMapping) return;
    const ok = await confirm({
      title: `Terminate ${student.name}?`,
      message: `Leaving ${currentBatch?.name ?? 'this batch'}. Any instalment already due is settled and their login is deleted. Records stay.`,
      confirmLabel: 'Terminate',
      danger: true,
      requireCheck: 'Yes, this student has left',
      requireText: 'TERMINATE',
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

  // For a student entered by mistake. Someone who left is terminated, so that is offered first.
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const counts = await getStudentDeletionCounts(student.id);
      const impact = DELETION_LABELS.map(([key, label]) => ({ label, count: counts[key] })).filter((row) => row.count > 0);
      const accepted = await confirm({
        title: `Delete ${student.name}?`,
        message: 'Delete only if the details were wrong. Otherwise terminate.',
        impact,
        alt: isActive ? { label: 'Terminate instead', onSelect: () => void handleTerminate() } : undefined,
        confirmLabel: 'Delete forever',
        danger: true,
        requireCheck: 'Yes, delete this student and everything attached, including their login',
        requireText: student.student_code ?? student.name,
      });
      if (!accepted) return;
      await deleteStudent(student.id);
      showToast(`${student.name} deleted`);
      navigate('/students', { replace: true });
    } catch (err) {
      showToast(errorMessage(err, 'Could not delete this student'), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const baseFee = currentBatch?.base_fee ?? null;
  const draftFee = feeDraft === null || feeDraft === '' ? null : Number(feeDraft);
  const feeFlag =
    draftFee === null || !currentFee ? ''
      : baseFee !== null && draftFee > baseFee ? `Above base ${formatCurrency(baseFee)}`
      : draftFee < currentFee.paid_amount ? `Below paid ${formatCurrency(currentFee.paid_amount)}`
      : '';

  const handleFeeSave = async () => {
    if (!currentMapping || !currentFee || draftFee === null) return;
    const accepted = await confirm({
      title: `Change fee to ${formatCurrency(draftFee)}?`,
      message: (
        <>
          <span className="block">{formatCurrency(currentFee.total_fee)} → {formatCurrency(draftFee)}</span>
          <span className="block">Discount reset to {formatCurrency(Math.max((baseFee ?? draftFee) - draftFee, 0))}</span>
          <span className="block">Instalments and dues recalculated</span>
          <span className="block">Batch fee totals and reports change</span>
        </>
      ),
      confirmLabel: 'Change fee',
      danger: true,
      requireCheck: 'Yes, change this fee',
      requireText: 'Confirm',
    });
    if (!accepted) return;

    setSavingFee(true);
    try {
      await setStudentFee(student.id, currentMapping.batch_id, draftFee);
      showToast('Fee changed');
      setFeeDraft(null);
      retry();
    } catch (err) {
      showToast(errorMessage(err, 'Could not change the fee'), 'error');
    } finally {
      setSavingFee(false);
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
    { label: 'Internship Role', value: student.internship_role ?? '' },
    { label: 'Internship Start', value: student.internship_start_date ? formatDate(student.internship_start_date) : '' },
    { label: 'Internship End', value: student.internship_end_date ? formatDate(student.internship_end_date) : '' },
  ].filter((fact) => fact.value);

  return (
    <div className="page-section">
      <div className="detail-topbar">
        <BackLink fallback="/students" />
        <div className="flex items-center gap-2">
          <Link to={`/students/${student.id}/edit`}>
            <Button variant="outline" className="action-button-compact"><Edit3 size={14} /> Edit</Button>
          </Link>
          {isActive && (
            <Button
              variant="outline"
              className="action-button-compact action-button-danger"
              onClick={handleTerminate}
              loading={terminating}
            >
              <UserMinus size={14} /> Terminate
            </Button>
          )}
          <Button
            variant="outline"
            className="action-button-compact action-button-danger"
            onClick={() => void handleDelete()}
            loading={deleting}
          >
            <Trash2 size={14} /> Delete
          </Button>
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
          <div className="flex items-center justify-between gap-2">
            <p className="student-summary-label">Current Batch</p>
            {currentMapping && <StatusPill kind="enrollment" value={currentMapping.status} />}
          </div>
          {currentMapping && batchMappings.length > 1 ? (
            <EnrolmentSelect mappings={newestFirst} value={currentMapping.batch_id} onChange={(id) => { setSelectedBatchId(id); setFeeDraft(null); }} />
          ) : currentBatch ? (
            <Link to={`/batches/${currentBatch.id}`} className="student-summary-value student-summary-link">
              {currentBatch.name}
            </Link>
          ) : (
            <p className="student-summary-empty">No current batch</p>
          )}
        </Card>
        <Card padding="sm" className="student-summary-card">
          <div className="flex items-center justify-between gap-2">
            <p className="student-summary-label">Total Payment</p>
            {isActive && currentFee && feeDraft === null && (
              <button
                type="button"
                onClick={() => setFeeDraft(String(currentFee.total_fee))}
                aria-label="Edit fee"
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]"
              >
                <Pencil size={14} />
              </button>
            )}
          </div>
          {isActive && currentFee && feeDraft !== null ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={currentFee.paid_amount}
                  max={baseFee ?? undefined}
                  value={feeDraft}
                  onChange={(event) => setFeeDraft(event.target.value)}
                  aria-invalid={Boolean(feeFlag)}
                  aria-label="Decided fee"
                  autoFocus
                />
                <Button
                  size="sm"
                  className="action-button-compact"
                  onClick={handleFeeSave}
                  loading={savingFee}
                  disabled={draftFee === null || Boolean(feeFlag) || draftFee === currentFee.total_fee}
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" className="action-button-compact" onClick={() => setFeeDraft(null)} disabled={savingFee}>
                  Cancel
                </Button>
              </div>
              {feeFlag ? <p className="field-flag">{feeFlag}</p> : (
                <p className="field-hint">Base {baseFee === null ? '—' : formatCurrency(baseFee)} · Paid {formatCurrency(currentFee.paid_amount)}</p>
              )}
            </div>
          ) : currentFee ? (
            <div className="student-summary-payment">
              <p className="student-summary-value">{formatCurrency(currentFee.paid_amount)} <span className="student-summary-total">/ {formatCurrency(currentFee.total_fee)}</span></p>
              <p className={`student-summary-status ${owed > 0 ? 'is-due' : 'is-paid'}`}>
                {owed > 0 ? `${formatCurrency(owed)} ${left ? 'void' : 'due'}` : left ? 'Nothing void' : 'Paid in full'}
              </p>
            </div>
          ) : (
            <p className="student-summary-empty">—</p>
          )}
        </Card>
        <Card padding="sm" className="student-summary-card">
          <p className="student-summary-label">Next Lecture</p>
          {nextLecture ? (
            <div className="student-summary-lecture">
              <p className="student-summary-value">{formatDate(nextLecture.lecture_date)}</p>
              <p className="student-summary-meta">
                {nextLecture.session_type}{nextLecture.meeting_code ? ` • ${nextLecture.meeting_code}` : ''}
              </p>
            </div>
          ) : (
            <p className="student-summary-empty">{isActive ? 'All lectures up to date' : '—'}</p>
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
        {paymentLogs.length === 0 && claims.length === 0 ? (
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
                <TH>Status</TH>
                <TH> </TH>
              </TR>
            </THead>
            <TBody>
              {claims.map((claim) => (
                <TR key={claim.id}>
                  <TD className="font-semibold text-[var(--warning-text)]">{formatCurrency(Number(claim.amount))}</TD>
                  <TD className="cell-secondary">{claim.created_at.slice(0, 10)}</TD>
                  <TD className="cell-secondary">{(claim.batch_id && batchNameById.get(claim.batch_id)) || '—'}</TD>
                  <TD className="cell-muted">UPI</TD>
                  <TD className="cell-muted">Student claim · Txn {claim.transaction_id}</TD>
                  <TD><Badge variant="warning" dot>Unverified</Badge></TD>
                  <TD className="w-px">
                    <ClaimActions claim={claim} name={student.name} onDone={retry} />
                  </TD>
                </TR>
              ))}
              {paymentLogs.map((log) => (
                <TR key={log.id}>
                  <TD className="font-semibold text-[var(--success-text)]">{formatCurrency(Number(log.amount))}</TD>
                  <TD className="cell-secondary">{log.payment_date}</TD>
                  <TD className="cell-secondary">{batchNameById.get(log.batch_id) ?? log.batch_id}</TD>
                  <TD className="cell-muted capitalize">{(log.payment_method ?? '—').replace('_', ' ')}</TD>
                  <TD className="cell-muted">{log.notes || '—'}</TD>
                  <TD><Badge variant="success" dot>Verified</Badge></TD>
                  <TD />
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
