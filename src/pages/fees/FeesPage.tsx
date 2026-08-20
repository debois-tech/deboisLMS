import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { StudentLink } from '@/components/students/StudentLink';
import { PaymentLogModal, type PaymentLogFormState } from '@/components/finance/PaymentLogModal';
import { getBatches, getFeesByBatch, getFeePaymentLogs, addFeePaymentLog, deleteFeePayment, getBatchFeeSummary, getBatchStudents } from '@/lib/supabase';
import type { Batch, StudentFee, Student, BatchStudentMapping, BatchFeeSummary, FeePaymentLog } from '@/lib/types';
import { formatCurrency } from '@/lib/utils/format';
import { useToast } from '@/lib/context/ToastContext';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { errorMessage } from '@/lib/utils/errors';

export default function FeesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [students, setStudents] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);
  const [summary, setSummary] = useState<BatchFeeSummary[]>([]);
  const [loggingFee, setLoggingFee] = useState<StudentFee | null>(null);
  const [paymentLogs, setPaymentLogs] = useState<FeePaymentLog[]>([]);
  const [logForm, setLogForm] = useState<PaymentLogFormState>({ amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'upi', notes: '' });
  const [logging, setLogging] = useState(false);
  const [deletingLogId, setDeletingLogId] = useState<string | null>(null);
  const { showToast } = useToast();
  const confirm = useConfirm();

  const { loading, error, retry } = useInitialLoad(async () => {
    const [b, s] = await Promise.all([getBatches(), getBatchFeeSummary()]);
    setBatches(b);
    setSummary(s);
  });

  const loadBatchFees = async (batchId: string) => {
    setSelectedBatch(batchId);
    try {
      const [f, s] = await Promise.all([getFeesByBatch(batchId), getBatchStudents(batchId)]);
      setFees(f);
      setStudents(s);
    } catch (err) {
      // Report without replacing the page, but clear the table so it doesn't keep the previous batch's rows.
      setFees([]);
      setStudents([]);
      showToast(errorMessage(err, 'Failed to load fees for this batch'), 'error');
    }
  };

  const openPaymentLogs = async (fee: StudentFee) => {
    setLoggingFee(fee);
    setLogForm({ amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'upi', notes: '' });
    try {
      setPaymentLogs(await getFeePaymentLogs(fee.id));
    } catch (err) {
      setPaymentLogs([]);
      showToast(errorMessage(err, 'Failed to load payment history'), 'error');
    }
  };

  const handleAddPaymentLog = async () => {
    if (!loggingFee || !logForm.amount || Number(logForm.amount) <= 0 || !logForm.payment_date) return;
    setLogging(true);
    try {
      const result = await addFeePaymentLog({
        student_fee_id: loggingFee.id,
        amount: Number(logForm.amount),
        payment_date: logForm.payment_date,
        payment_method: logForm.payment_method,
        notes: logForm.notes,
      });
      if (result) {
        setLoggingFee(result.fee);
        setPaymentLogs((prev) => [result.log, ...prev]);
        setFees((prev) => prev.map((f) => (f.id === result.fee.id ? result.fee : f)));
        setLogForm({ amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'upi', notes: '' });
        getBatchFeeSummary().then(setSummary);
        showToast('Payment logged');
      }
    } catch (error) {
      showToast(errorMessage(error, 'Failed to log payment'), 'error');
    }
    setLogging(false);
  };

  // The balance goes back where it came from — pending for an enrolled student,
  // void for one who left — because both are worked out from what was paid.
  const handleDeletePaymentLog = async (log: FeePaymentLog) => {
    const ok = await confirm({
      title: `Delete this ${formatCurrency(Number(log.amount))} payment?`,
      message: 'The amount goes back to what is owed. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;

    setDeletingLogId(log.id);
    try {
      const fee = await deleteFeePayment(log.id);
      setLoggingFee(fee);
      setPaymentLogs((prev) => prev.filter((entry) => entry.id !== log.id));
      setFees((prev) => prev.map((f) => (f.id === fee.id ? fee : f)));
      getBatchFeeSummary().then(setSummary);
      showToast('Payment deleted');
    } catch (error) {
      showToast(errorMessage(error, 'Failed to delete payment'), 'error');
    }
    setDeletingLogId(null);
  };

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  const selectedSummary = selectedBatch ? summary.find((item) => item.batch_id === selectedBatch) : undefined;

  return (
    <div className="page-section">
      <PageHeader title="Finance" />

      <Card className="step-card">
        <CardHeader title="Select Batch" />
        <BatchSelect batches={batches} value={selectedBatch} onChange={loadBatchFees} />
      </Card>

      {selectedBatch && selectedSummary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card padding="sm"><p className="text-xs text-[var(--text-muted)]">Total Fees</p><p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{formatCurrency(selectedSummary.total_fees)}</p></Card>
          <Card padding="sm"><p className="text-xs text-[var(--text-muted)]">Collected</p><p className="mt-1 text-lg font-bold text-[var(--success-text)]">{formatCurrency(selectedSummary.total_collected)}</p></Card>
          <Card padding="sm"><p className="text-xs text-[var(--text-muted)]">Outstanding</p><p className="mt-1 text-lg font-bold text-[var(--danger-text)]">{formatCurrency(selectedSummary.total_outstanding)}</p></Card>
          <Card padding="sm"><p className="text-xs text-[var(--text-muted)]">Students</p><p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{selectedSummary.total_students}</p></Card>
        </div>
      )}

      {selectedBatch && (
        <Card>
          <CardHeader title="Per-Student Fees" className="mb-8" />
          {fees.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]" style={{ padding: '1rem 1.25rem' }}>No fee records.</p>
          ) : (
            <div style={{ marginTop: '0.75rem' }}>
              <Table maxHeight="28rem">
              <THead>
                <TR>
                  <TH>Student</TH>
                  <TH>Total Fee</TH>
                  <TH>Paid</TH>
                  <TH>Remaining</TH>
                  <TH>Status</TH>
                  <TH>Action</TH>
                </TR>
              </THead>
              <TBody>
                {fees.map((fee) => {
                  const student = students.find((item) => item.id === fee.student_id);
                  // A leaver owes their void; the rest of the fee never became due.
                  const owed = fee.expected_on_exit ?? fee.total_fee;
                  const remaining = Math.max(0, owed - fee.paid_amount);
                  const isPaid = fee.status === 'paid' || remaining <= 0;
                  return (
                    <TR key={fee.id}>
                      <TD className="font-medium">
                        <StudentLink studentId={fee.student_id} name={student?.name ?? 'Unknown'} />
                      </TD>
                      <TD>{formatCurrency(fee.total_fee)}</TD>
                      <TD>{formatCurrency(fee.paid_amount)}</TD>
                      <TD>
                        <span className={isPaid ? 'text-[var(--success-text)]' : 'text-[var(--danger-text)]'}>
                          {isPaid ? '—' : formatCurrency(remaining)}
                        </span>
                      </TD>
                      <TD><StatusPill kind="fee" value={isPaid ? 'paid' : 'due'} /></TD>
                      <TD>
                        <Button size="sm" className="action-button-compact" onClick={() => openPaymentLogs(fee)}>
                          <Plus size={14} /> Log Payment
                        </Button>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
              </Table>
            </div>
          )}
        </Card>
      )}

      <PaymentLogModal
        fee={loggingFee}
        studentName={students.find((s) => s.id === loggingFee?.student_id)?.name ?? 'Student'}
        paymentLogs={paymentLogs}
        form={logForm}
        onFormChange={setLogForm}
        onClose={() => setLoggingFee(null)}
        onSubmit={handleAddPaymentLog}
        submitting={logging}
        onDelete={handleDeletePaymentLog}
        deletingId={deletingLogId}
      />
    </div>
  );
}
