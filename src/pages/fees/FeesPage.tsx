import { useState, useEffect } from 'react';
import { DollarSign } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { getBatches } from '@/lib/supabase';
import { getFeesByBatch, updateFeePayment, getBatchFeeSummary } from '@/lib/supabase';
import { getBatchStudents } from '@/lib/supabase';
import type { Batch, StudentFee, Student, BatchStudentMapping, BatchFeeSummary } from '@/lib/types';

export default function FeesPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [students, setStudents] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);
  const [summary, setSummary] = useState<BatchFeeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFee, setEditingFee] = useState<{ id: string; paid: number } | null>(null);

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
    await updateFeePayment(editingFee.id, editingFee.paid);
    setEditingFee(null);
    if (selectedBatch) loadBatchFees(selectedBatch);
    getBatchFeeSummary().then(setSummary);
  };

  if (loading) return <Spinner />;

  const getBatchSummary = (batchId: string) => summary.find((s) => s.batch_id === batchId);

  return (
    <div className="page-section">
      <PageHeader title="Finance" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {batches.map((b) => {
          const s = getBatchSummary(b.id);
          return (
            <button
              key={b.id}
              onClick={() => loadBatchFees(b.id)}
              className={`text-left p-4 rounded-[var(--radius-lg)] border transition-all ${
                selectedBatch === b.id
                  ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                  : 'border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--primary)]/30'
              }`}
            >
              <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{b.name}</p>
              {s && (
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Total:</span><span className="text-[var(--text-primary)]">₹{s.total_fees.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Collected:</span><span className="text-emerald-400">₹{s.total_collected.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Outstanding:</span><span className="text-red-400">₹{s.total_outstanding.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-muted)]">Students:</span><span className="text-[var(--text-primary)]">{s.total_students}</span></div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedBatch && (
        <Card>
          <CardHeader title="Per-Student Fees" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left p-3 text-[var(--text-muted)] font-medium">Student</th>
                  <th className="text-left p-3 text-[var(--text-muted)] font-medium">Total Fee</th>
                  <th className="text-left p-3 text-[var(--text-muted)] font-medium">Paid</th>
                  <th className="text-left p-3 text-[var(--text-muted)] font-medium">Remaining</th>
                  <th className="text-left p-3 text-[var(--text-muted)] font-medium">Status</th>
                  <th className="text-left p-3 text-[var(--text-muted)] font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {fees.map((fee) => {
                  const student = students.find((s) => s.id === fee.student_id);
                  const remaining = fee.total_fee - fee.paid_amount;
                  const isPaid = remaining <= 0;
                  return (
                    <tr key={fee.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-elevated)]/50">
                      <td className="p-3 text-[var(--text-primary)] font-medium">{student?.name ?? 'Unknown'}</td>
                      <td className="p-3 text-[var(--text-primary)]">₹{fee.total_fee.toLocaleString()}</td>
                      <td className="p-3 text-[var(--text-primary)]">₹{fee.paid_amount.toLocaleString()}</td>
                      <td className="p-3">
                        <span className={isPaid ? 'text-emerald-400' : 'text-red-400'}>
                          {isPaid ? '—' : `₹${remaining.toLocaleString()}`}
                        </span>
                      </td>
                      <td className="p-3">
                        {isPaid ? <Badge variant="success">Paid</Badge> : <Badge variant="warning">Due</Badge>}
                      </td>
                      <td className="p-3">
                        <Button size="sm" variant="ghost" onClick={() => setEditingFee({ id: fee.id, paid: fee.paid_amount })}>
                          Update
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={!!editingFee} onClose={() => setEditingFee(null)} title="Update Payment">
        {editingFee && (
          <div className="space-y-4">
            <div className="field">
              <label className="text-sm font-medium text-[var(--text-primary)]">Paid Amount (₹)</label>
              <input type="number" value={editingFee.paid} onChange={(e) => setEditingFee({ ...editingFee, paid: Number(e.target.value) })} />
            </div>
            <Button onClick={handleSavePayment}>Save</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
