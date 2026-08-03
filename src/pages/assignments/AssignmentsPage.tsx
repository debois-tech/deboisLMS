import { useState, useEffect } from 'react';
import { ClipboardCheck, Plus } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { AssignmentSelect } from '@/components/ui/AssignmentSelect';
import { FormField } from '@/components/ui/FormField';
import { AssignmentSubmissionTable } from '@/components/assignments/AssignmentSubmissionTable';
import { getBatches, getAssignmentsByBatch, createAssignment } from '@/lib/supabase';
import type { Batch, Assignment } from '@/lib/types';
import { useToast } from '@/lib/context/ToastContext';

export default function AssignmentsPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAsgn, setSelectedAsgn] = useState<string | null>(null);
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
    getAssignmentsByBatch(batchId).then((a) => {
      setAssignments(a);
      setSelectedAsgn(null);
    });
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
            <EmptyState icon={<ClipboardCheck size={32} />} title="No assignments" />
          ) : (
            <AssignmentSelect assignments={assignments} value={selectedAsgn} onChange={setSelectedAsgn} />
          )}
        </Card>
      )}

      {selectedBatch && selectedAsgn && (
        <Card>
          <CardHeader title="3. Submission Status" />
          <AssignmentSubmissionTable
            key={selectedAsgn}
            assignmentId={selectedAsgn}
            batchId={selectedBatch}
            assignmentTitle={assignments.find((a) => a.id === selectedAsgn)?.title ?? 'assignment'}
          />
        </Card>
      )}

      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title="New Assignment"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button className="action-button-compact" onClick={handleCreate} disabled={!form.title.trim()}>
              Create Assignment
            </Button>
          </>
        }
      >
        <div className="popup-form-spaced">
          <FormField label="Title" required>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </FormField>
          <FormField label="Description">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </FormField>
          <FormField label="Due Date">
            <input type="date" value={form.assigned_date} onChange={(e) => setForm({ ...form, assigned_date: e.target.value })} />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
