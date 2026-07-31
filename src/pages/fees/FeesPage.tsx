import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { History, Plus } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { FormField } from '@/components/ui/FormField';
import { getBatches, getFeesByBatch, getFeePaymentLogs, addFeePaymentLog, getBatchFeeSummary, getBatchStudents } from '@/lib/supabase';
import type { Batch, StudentFee, Student, BatchStudentMapping, BatchFeeSummary, FeePaymentLog, PaymentMethod } from '@/lib/types';
import { formatCurrency } from '@/lib/utils/format';

export default function FeesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [students, setStudents] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);
  const [summary, setSummary] = useState<BatchFeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingFee, setLoggingFee] = useState<StudentFee | null>(null);
  const [paymentLogs, setPaymentLogs] = useState<FeePaymentLog[]>([]);
  const [logForm, setLogForm] = useState({ amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'other' as PaymentMethod, notes: '' });
  const [logging, setLogging] = useState(false);

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
    }
    setLogging(false);
  };

  if (loading) return <Spinner centered />;
  const selectedSummary = selectedBatch ? summary.find((item) => item.batch_id === selectedBatch) : undefined;
  const loggingRemaining = loggingFee ? Math.max(0, loggingFee.total_fee - loggingFee.paid_amount) : 0;

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
          <CardHeader title="Per-Student Fees" subtitle="Track payments and update collection status" />
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
                        <Link to={`/students/${fee.student_id}`} className="text-[var(--text-primary)] hover:underline">
                          {student?.name ?? 'Unknown'}
                        </Link>
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
                        <Button size="sm" className="action-button" onClick={() => openPaymentLogs(fee)}>
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

      <Modal open={!!loggingFee} onClose={() => setLoggingFee(null)} title="Payment Log" size="xl">
        {loggingFee && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-[var(--radius-md)] bg-[var(--bg-elevated)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Student</p>
                <p className="mt-1.5 font-semibold text-[var(--text-primary)]">{students.find((s) => s.id === loggingFee.student_id)?.name ?? 'Student'}</p>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--bg-elevated)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Paid</p>
                <p className="mt-1.5 font-semibold text-emerald-400">{formatCurrency(loggingFee.paid_amount)}</p>
              </div>
              <div className="rounded-[var(--radius-md)] bg-[var(--bg-elevated)] p-4">
                <p className="text-xs text-[var(--text-muted)]">Remaining</p>
                <p className={`mt-1.5 font-semibold ${loggingRemaining > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {loggingRemaining > 0 ? formatCurrency(loggingRemaining) : 'Paid in full'}
                </p>
              </div>
            </div>

            <div className="payment-log-form space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Amount (₹)" required>
                  <input type="number" min="1" value={logForm.amount} onChange={(event) => setLogForm({ ...logForm, amount: event.target.value })} />
                </FormField>
                <FormField label="Payment Date" required>
                  <input type="date" value={logForm.payment_date} onChange={(event) => setLogForm({ ...logForm, payment_date: event.target.value })} />
                </FormField>
              </div>
              <FormField label="Payment Method">
                <select value={logForm.payment_method} onChange={(event) => setLogForm({ ...logForm, payment_method: event.target.value as PaymentMethod })}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="other">Other</option>
                </select>
              </FormField>
              <FormField label="Notes">
                <textarea value={logForm.notes} onChange={(event) => setLogForm({ ...logForm, notes: event.target.value })} placeholder="Optional note" />
              </FormField>
              <div className="flex justify-end">
                <Button className="action-button" onClick={handleAddPaymentLog} loading={logging} disabled={!logForm.amount || Number(logForm.amount) <= 0}>
                  <Plus size={14} /> Add Log
                </Button>
              </div>
            </div>

            <hr className="divider m-0" />

            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <History size={15} /> Previous Payments
              </div>
              {paymentLogs.length === 0 ? (
                <p className="text-sm text-[var(--text-muted)]">No payment logs yet.</p>
              ) : (
                <Table maxHeight="16rem">
                  <THead>
                    <TR>
                      <TH>Amount</TH>
                      <TH>Date</TH>
                      <TH>Method</TH>
                      <TH>Notes</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {paymentLogs.map((log) => (
                      <TR key={log.id}>
                        <TD className="font-semibold text-emerald-400">{formatCurrency(Number(log.amount))}</TD>
                        <TD className="cell-secondary">{log.payment_date}</TD>
                        <TD className="cell-muted capitalize">{(log.payment_method ?? '—').replace('_', ' ')}</TD>
                        <TD className="cell-muted">{log.notes || '—'}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
