import { useState, useEffect } from 'react';
import { ClipboardCheck, Plus, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { PageHeader } from '@/components/ui/PageHeader';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { AssignmentSelect } from '@/components/ui/AssignmentSelect';
import { FormField } from '@/components/ui/FormField';
import { getBatches } from '@/lib/supabase';
import { getAssignmentsByBatch, createAssignment, getCompletionsByAssignment, markSubmission } from '@/lib/supabase';
import { getBatchStudents } from '@/lib/supabase';
import type { Batch, Assignment, AssignmentCompletion, Student, BatchStudentMapping } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';
import { useToast } from '@/lib/context/ToastContext';

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
  const { showToast } = useToast();

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
    try {
      await createAssignment({ ...form, batch_id: selectedBatch });
      setShowNew(false);
      setForm({ title: '', description: '', assigned_date: '' });
      fetchBatchData(selectedBatch);
      showToast('Assignment created');
    } catch (error: any) {
      showToast(error?.message ?? 'Failed to create assignment', 'error');
    }
  };

  const handleToggle = async (studentId: string, assignmentId: string, current: boolean) => {
    try {
      await markSubmission(assignmentId, studentId, !current);
      loadCompletions(assignmentId);
    } catch (error: any) {
      showToast(error?.message ?? 'Failed to update submission', 'error');
    }
  };

  if (loading) return <Spinner centered />;

  return (
    <div className="page-section">
      <PageHeader title="Assignments" />

      <Card>
        <CardHeader title="1. Select Batch" />
        <BatchSelect batches={batches} value={selectedBatch} onChange={fetchBatchData} />
      </Card>

      {selectedBatch && (
        <Card>
          <CardHeader
            title="2. Select Assignment"
            action={<Button size="sm" className="action-button-compact" onClick={() => setShowNew(true)}><Plus size={14} /> New Assignment</Button>}
          />
          {assignments.length === 0 ? (
            <EmptyState icon={<ClipboardCheck size={32} />} title="No assignments" description="Create a new assignment to track student submissions" />
          ) : (
            <AssignmentSelect assignments={assignments} value={selectedAsgn} onChange={loadCompletions} />
          )}
        </Card>
      )}

      {selectedAsgn && (
        <Card>
          <CardHeader title="3. Submission Status" />
          <Table maxHeight="24rem">
            <THead>
              <TR>
                <TH>Student</TH>
                <TH align="center">Submitted</TH>
                <TH>Via</TH>
                <TH>Submitted At</TH>
              </TR>
            </THead>
            <TBody>
              {students.map((s) => {
                const comp = completions.find((c) => c.student_id === s.id);
                const submitted = comp?.submitted ?? false;
                return (
                  <TR key={s.id}>
                    <TD className="font-medium text-[var(--text-primary)]">{s.name}</TD>
                    <TD align="center">
                      <button
                        onClick={() => handleToggle(s.id, selectedAsgn, submitted)}
                        className={submitted ? 'text-emerald-400' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}
                      >
                        {submitted ? <CheckCircle size={20} /> : <XCircle size={20} />}
                      </button>
                    </TD>
                    <TD className="cell-secondary text-xs">{comp?.submitted_via ?? '—'}</TD>
                    <TD className="cell-secondary text-xs">{comp?.submitted_at ? formatDate(comp.submitted_at) : '—'}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Assignment">
        <div className="space-y-4">
          <FormField label="Title" required>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </FormField>
          <FormField label="Description">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </FormField>
          <FormField label="Due Date">
            <input type="date" value={form.assigned_date} onChange={(e) => setForm({ ...form, assigned_date: e.target.value })} />
          </FormField>
          <Button onClick={handleCreate}>Create Assignment</Button>
        </div>
      </Modal>
    </div>
  );
}
