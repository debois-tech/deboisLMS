import { useState, useEffect } from 'react';
import { FileText, Plus, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { getBatches } from '@/lib/supabase';
import { getAssignmentsByBatch, createAssignment, getCompletionsByAssignment, markSubmission } from '@/lib/supabase';
import { getBatchStudents } from '@/lib/supabase';
import type { Batch, Assignment, AssignmentCompletion, Student, BatchStudentMapping } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';

export default function AssignmentsPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAsgn, setSelectedAsgn] = useState<string | null>(null);
  const [completions, setCompletions] = useState<(AssignmentCompletion & { student_name: string })[]>([]);
  const [students, setStudents] = useState<(Student & { mapping: BatchStudentMapping })[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', assigned_date: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBatches().then((b) => {
      setBatches(b);
      setLoading(false);
    });
  }, []);

  const fetchBatchData = (batchId: string) => {
    setSelectedBatch(batchId);
    Promise.all([
      getAssignmentsByBatch(batchId),
      getBatchStudents(batchId),
    ]).then(([a, s]) => {
      setAssignments(a);
      setStudents(s.filter((st) => st.mapping.status === 'active'));
      setSelectedAsgn(null);
      setCompletions([]);
    });
  };

  const loadCompletions = (asgnId: string) => {
    setSelectedAsgn(asgnId);
    getCompletionsByAssignment(asgnId).then(setCompletions);
  };

  const handleCreate = async () => {
    if (!selectedBatch) return;
    await createAssignment({ ...form, batch_id: selectedBatch });
    setShowNew(false);
    setForm({ title: '', description: '', assigned_date: '' });
    fetchBatchData(selectedBatch);
  };

  const handleToggle = async (studentId: string, assignmentId: string, current: boolean) => {
    await markSubmission(assignmentId, studentId, !current);
    loadCompletions(assignmentId);
  };

  if (loading) return <Spinner centered />;

  return (
    <div className="page-section">
      <PageHeader title="Assignments" />

      <Card>
        <CardHeader title="Select Batch" />
        <BatchSelect batches={batches} value={selectedBatch} onChange={fetchBatchData} />
      </Card>

      {selectedBatch && (
        <Card>
          <CardHeader
            title="Assignments"
            action={<Button size="sm" className="action-button" onClick={() => setShowNew(true)}><Plus size={14} /> New Assignment</Button>}
          />
          {assignments.length === 0 ? (
            <EmptyState icon={<FileText size={32} />} title="No assignments" />
          ) : (
            <div className="space-y-2">
              {assignments.map((a) => {
                const asgnCompletions = completions.filter((c) => c.assignment_id === a.id);
                const submittedCount = asgnCompletions.filter((c) => c.submitted).length;
                return (
                  <div
                    key={a.id}
                    onClick={() => loadCompletions(a.id)}
                    className={`p-3 rounded-[var(--radius-md)] cursor-pointer transition-colors ${
                      selectedAsgn === a.id
                        ? 'bg-[var(--primary)]/10 border border-[var(--primary)]/20'
                        : 'hover:bg-[var(--bg-elevated)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{a.title}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          {a.assigned_date ? formatDate(a.assigned_date) : '—'}
                          {a.description ? ` • ${a.description.substring(0, 60)}${a.description.length > 60 ? '...' : ''}` : ''}
                        </p>
                      </div>
                      {selectedAsgn === a.id && completions.length > 0 && (
                        <span className="text-xs text-[var(--text-muted)]">
                          {submittedCount}/{completions.length} submitted
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {selectedAsgn && (
        <Card>
          <CardHeader title="Submission Status" />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="text-left p-3 text-[var(--text-muted)] font-medium">Student</th>
                  <th className="text-center p-3 text-[var(--text-muted)] font-medium">Submitted</th>
                  <th className="text-left p-3 text-[var(--text-muted)] font-medium">Via</th>
                  <th className="text-left p-3 text-[var(--text-muted)] font-medium">Submitted At</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const comp = completions.find((c) => c.student_id === s.id);
                  const submitted = comp?.submitted ?? false;
                  return (
                    <tr key={s.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-elevated)]/50">
                      <td className="p-3 text-[var(--text-primary)] font-medium">{s.name}</td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleToggle(s.id, selectedAsgn, submitted)}
                          className={submitted ? 'text-emerald-400' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}
                        >
                          {submitted ? <CheckCircle size={20} /> : <XCircle size={20} />}
                        </button>
                      </td>
                      <td className="p-3 text-[var(--text-secondary)] text-xs">
                        {comp?.submitted_via ?? '—'}
                      </td>
                      <td className="p-3 text-[var(--text-secondary)] text-xs">
                        {comp?.submitted_at ? formatDate(comp.submitted_at) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Assignment">
        <div className="space-y-4">
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Title *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <div className="field">
            <label className="text-sm font-medium text-[var(--text-primary)]">Due Date</label>
            <input type="date" value={form.assigned_date} onChange={(e) => setForm({ ...form, assigned_date: e.target.value })} />
          </div>
          <Button onClick={handleCreate}>Create Assignment</Button>
        </div>
      </Modal>
    </div>
  );
}
