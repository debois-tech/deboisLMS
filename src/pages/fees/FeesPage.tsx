import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { StudentLink } from '@/components/students/StudentLink';
import { PaymentLogModal, type PaymentLogFormState } from '@/components/finance/PaymentLogModal';
import { getBatches, getFeesByBatch, getFeePaymentLogs, addFeePaymentLog, getBatchFeeSummary, getBatchStudents } from '@/lib/supabase';
import type { Batch, StudentFee, Student, BatchStudentMapping, BatchFeeSummary, FeePaymentLog } from '@/lib/types';
import { formatCurrency } from '@/lib/utils/format';
import { useToast } from '@/lib/context/ToastContext';

export default function FeesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [students, setStudents] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);
  const [summary, setSummary] = useState<BatchFeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingFee, setLoggingFee] = useState<StudentFee | null>(null);
  const [paymentLogs, setPaymentLogs] = useState<FeePaymentLog[]>([]);
  const [logForm, setLogForm] = useState<PaymentLogFormState>({ amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'other', notes: '' });
  const [logging, setLogging] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    Promise.all([getBatches(), getBatchFeeSummary()]).then(([b, s]) => {
      setBatches(b);
      setSummary(s);
      setLoading(false);
    });
  }, []);

  const loadBatchFees = (batchId: string) => {
    setSelectedBatch(batchId);
    Promise.all([getFeesByBatch(batchId), getBatchStudents(batchId)]).then(([f, s]) => {
      setFees(f);
      setStudents(s);
    });
  };

  const openPaymentLogs = async (fee: StudentFee) => {
    setLoggingFee(fee);
    setLogForm({ amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'other', notes: '' });
    setPaymentLogs(await getFeePaymentLogs(fee.id));
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
        setLogForm({ amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'other', notes: '' });
        getBatchFeeSummary().then(setSummary);
        showToast('Payment logged successfully');
      }
    } catch (error: any) {
      showToast(error?.message ?? 'Failed to log payment', 'error');
    }
    setLogging(false);
  };

  if (loading) return <Spinner centered />;
  const selectedSummary = selectedBatch ? summary.find((item) => item.batch_id === selectedBatch) : undefined;

  return (
    <div className="page-section">
      <PageHeader title="Finance" />

      <Card>
        <CardHeader title="Select Batch" />
        <BatchSelect batches={batches} value={selectedBatch} onChange={loadBatchFees} />
      </Card>

      {selectedBatch && selectedSummary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card padding="sm"><p className="text-xs text-[var(--text-muted)]">Total Fees</p><p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{formatCurrency(selectedSummary.total_fees)}</p></Card>
          <Card padding="sm"><p className="text-xs text-[var(--text-muted)]">Collected</p><p className="mt-1 text-lg font-bold text-emerald-400">{formatCurrency(selectedSummary.total_collected)}</p></Card>
          <Card padding="sm"><p className="text-xs text-[var(--text-muted)]">Outstanding</p><p className="mt-1 text-lg font-bold text-red-400">{formatCurrency(selectedSummary.total_outstanding)}</p></Card>
          <Card padding="sm"><p className="text-xs text-[var(--text-muted)]">Students</p><p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{selectedSummary.total_students}</p></Card>
        </div>
      )}

      {selectedBatch && (
        <Card>
          <CardHeader title="Per-Student Fees"/>
          {fees.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]" style={{ padding: '1rem 1.25rem' }}>No fee records for this batch.</p>
          ) : (
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
                  const remaining = fee.total_fee - fee.paid_amount;
                  const isPaid = fee.status === 'paid' || remaining <= 0;
                  return (
                    <TR key={fee.id}>
                      <TD className="font-medium">
                        <StudentLink studentId={fee.student_id} name={student?.name ?? 'Unknown'} />
                      </TD>
                      <TD>{formatCurrency(fee.total_fee)}</TD>
                      <TD>{formatCurrency(fee.paid_amount)}</TD>
                      <TD>
                        <span className={isPaid ? 'text-emerald-400' : 'text-red-400'}>
                          {isPaid ? '—' : formatCurrency(remaining)}
                        </span>
                      </TD>
                      <TD>{isPaid ? <Badge size="lg" variant="success">Paid</Badge> : <Badge size="lg" variant="warning">Due</Badge>}</TD>
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
      />
    </div>
  );
}
