import { useEffect, useState } from 'react';
import { History, Plus } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { getBatches, getFeesByBatch, updateFeeTotal, getFeePaymentLogs, addFeePaymentLog, getBatchFeeSummary, getBatchStudents } from '@/lib/supabase';
import type { Batch, StudentFee, Student, BatchStudentMapping, BatchFeeSummary, FeePaymentLog, PaymentMethod } from '@/lib/types';

export default function FeesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [students, setStudents] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);
  const [summary, setSummary] = useState<BatchFeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFee, setEditingFee] = useState<{ id: string; total: number } | null>(null);
  const [loggingFee, setLoggingFee] = useState<StudentFee | null>(null);
  const [paymentLogs, setPaymentLogs] = useState<FeePaymentLog[]>([]);
  const [logForm, setLogForm] = useState({ amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'other' as PaymentMethod, notes: '' });

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

  const handleSavePayment = async () => {
    if (!editingFee) return;
    await updateFeeTotal(editingFee.id, editingFee.total);
    setEditingFee(null);
    if (selectedBatch) loadBatchFees(selectedBatch);
    getBatchFeeSummary().then(setSummary);
  };

  const openPaymentLogs = async (fee: StudentFee) => {
    setLoggingFee(fee);
    setLogForm({ amount: '', payment_date: new Date().toISOString().slice(0, 10), payment_method: 'other', notes: '' });
    setPaymentLogs(await getFeePaymentLogs(fee.id));
  };

  const handleAddPaymentLog = async () => {
    if (!loggingFee || !logForm.amount || Number(logForm.amount) <= 0 || !logForm.payment_date) return;
    await addFeePaymentLog({ student_fee_id: loggingFee.id, amount: Number(logForm.amount), payment_date: logForm.payment_date, payment_method: logForm.payment_method, notes: logForm.notes });
    setLoggingFee(null);
    if (selectedBatch) loadBatchFees(selectedBatch);
    getBatchFeeSummary().then(setSummary);
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
          <Card padding="sm"><p className="text-xs text-[var(--text-muted)]">Total Fees</p><p className="mt-1 text-lg font-bold text-[var(--text-primary)]">₹{selectedSummary.total_fees.toLocaleString()}</p></Card>
          <Card padding="sm"><p className="text-xs text-[var(--text-muted)]">Collected</p><p className="mt-1 text-lg font-bold text-emerald-400">₹{selectedSummary.total_collected.toLocaleString()}</p></Card>
          <Card padding="sm"><p className="text-xs text-[var(--text-muted)]">Outstanding</p><p className="mt-1 text-lg font-bold text-red-400">₹{selectedSummary.total_outstanding.toLocaleString()}</p></Card>
          <Card padding="sm"><p className="text-xs text-[var(--text-muted)]">Students</p><p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{selectedSummary.total_students}</p></Card>
        </div>
      )}

      {selectedBatch && (
        <Card>
          <CardHeader title="Per-Student Fees" subtitle="Track payments and update collection status" />
          {fees.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]" style={{ padding: '1rem 1.25rem' }}>No fee records for this batch.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[var(--border)]">
                  {['Student', 'Total Fee', 'Paid', 'Remaining', 'Status', 'Action'].map((heading) => <th key={heading} className="text-left font-medium text-[var(--text-muted)]" style={{ padding: '0.75rem 1rem' }}>{heading}</th>)}
                </tr></thead>
                <tbody>{fees.map((fee) => {
                  const student = students.find((item) => item.id === fee.student_id);
                  const remaining = fee.total_fee - fee.paid_amount;
                  const isPaid = fee.status === 'paid';
                  return <tr key={fee.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-elevated)]/50">
                    <td className="font-medium text-[var(--text-primary)]" style={{ padding: '0.75rem 1rem' }}>{student?.name ?? 'Unknown'}</td>
                    <td className="text-[var(--text-primary)]" style={{ padding: '0.75rem 1rem' }}>₹{fee.total_fee.toLocaleString()}</td>
                    <td className="text-[var(--text-primary)]" style={{ padding: '0.75rem 1rem' }}>₹{fee.paid_amount.toLocaleString()}</td>
                    <td style={{ padding: '0.75rem 1rem' }}><span className={isPaid ? 'text-emerald-400' : 'text-red-400'}>{isPaid ? '—' : `₹${remaining.toLocaleString()}`}</span></td>
                    <td style={{ padding: '0.75rem 1rem' }}>{isPaid ? <Badge size="lg" variant="success">Paid</Badge> : <Badge size="lg" variant="warning">Due</Badge>}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" className="action-button" onClick={() => openPaymentLogs(fee)}><Plus size={14} /> Log Payment</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingFee({ id: fee.id, total: fee.total_fee })}>Update Total</Button>
                      </div>
                    </td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      <Modal open={!!editingFee} onClose={() => setEditingFee(null)} title="Update Payment">
        {editingFee && <div className="space-y-4">
          <div className="field"><label className="text-sm font-medium text-[var(--text-primary)]">Total Fee (₹)</label><input type="number" min="0" value={editingFee.total} onChange={(event) => setEditingFee({ ...editingFee, total: Number(event.target.value) })} /></div>
          <Button className="action-button" onClick={handleSavePayment}>Save</Button>
        </div>}
      </Modal>

      <Modal open={!!loggingFee} onClose={() => setLoggingFee(null)} title="Payment Log" size="lg">
        {loggingFee && <div className="space-y-5">
          <div className="rounded-[var(--radius-md)] bg-[var(--bg-elevated)] text-sm text-[var(--text-secondary)]" style={{ padding: '1rem 1.25rem' }}>
            <p className="font-semibold text-[var(--text-primary)]">{students.find((student) => student.id === loggingFee.student_id)?.name ?? 'Student'}</p>
            <p className="mt-1">Current paid total: ₹{loggingFee.paid_amount.toLocaleString()}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="field"><label className="text-sm font-medium text-[var(--text-primary)]">Amount (₹) *</label><input type="number" min="1" value={logForm.amount} onChange={(event) => setLogForm({ ...logForm, amount: event.target.value })} /></div>
            <div className="field"><label className="text-sm font-medium text-[var(--text-primary)]">Payment Date *</label><input type="date" value={logForm.payment_date} onChange={(event) => setLogForm({ ...logForm, payment_date: event.target.value })} /></div>
          </div>
          <div className="field"><label className="text-sm font-medium text-[var(--text-primary)]">Payment Method</label><select value={logForm.payment_method} onChange={(event) => setLogForm({ ...logForm, payment_method: event.target.value as PaymentMethod })}><option value="cash">Cash</option><option value="upi">UPI</option><option value="bank_transfer">Bank transfer</option><option value="other">Other</option></select></div>
          <div className="field"><label className="text-sm font-medium text-[var(--text-primary)]">Notes</label><textarea value={logForm.notes} onChange={(event) => setLogForm({ ...logForm, notes: event.target.value })} placeholder="Optional note" /></div>
          <div className="flex justify-end"><Button className="action-button" onClick={handleAddPaymentLog} disabled={!logForm.amount || Number(logForm.amount) <= 0}><Plus size={14} /> Add Log</Button></div>
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]"><History size={15} /> Previous Payments</div>
            {paymentLogs.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No payment logs yet.</p> : <div className="space-y-2">{paymentLogs.map((log) => <div key={log.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-md)] bg-[var(--bg-elevated)] text-sm" style={{ padding: '0.75rem 1rem' }}><span className="font-semibold text-emerald-400">₹{Number(log.amount).toLocaleString()}</span><span className="text-[var(--text-secondary)]">{log.payment_date}</span><span className="text-[var(--text-muted)]">{log.payment_method || '—'}</span><span className="text-[var(--text-muted)]">{log.notes || ''}</span></div>)}</div>}
          </div>
        </div>}
      </Modal>
    </div>
  );
}
