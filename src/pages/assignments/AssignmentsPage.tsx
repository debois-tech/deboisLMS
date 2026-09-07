import { useState } from 'react';
import { Edit3, Plus } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/ui/ErrorState';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { PageHeader } from '@/components/ui/PageHeader';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { AssignmentSelect } from '@/components/ui/AssignmentSelect';
import { FormField } from '@/components/ui/FormField';
import { FieldNotice } from '@/components/ui/FieldNotice';
import { AssignmentSubmissionTable } from '@/components/assignments/AssignmentSubmissionTable';
import { AssignmentFiles } from '@/components/assignments/AssignmentFiles';
import { NewAssignmentModal } from '@/components/assignments/NewAssignmentModal';
import { getBatches, getAssignmentsByBatch } from '@/lib/supabase';
import type { Batch, Assignment } from '@/lib/types';
import { useToast } from '@/lib/context/ToastContext';
import { errorMessage } from '@/lib/utils/errors';

export default function AssignmentsPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedAsgn, setSelectedAsgn] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const { showToast } = useToast();

  const selectedAssignment = assignments.find((a) => a.id === selectedAsgn);

  const { loading, error, retry } = useInitialLoad(async () => {
    setBatches(await getBatches());
  });

  const fetchBatchData = async (batchId: string) => {
    setSelectedBatch(batchId);
    setSelectedAsgn(null);
    try {
      setAssignments(await getAssignmentsByBatch(batchId));
    } catch (err) {
      setAssignments([]);
      showToast(errorMessage(err, 'Failed to load assignments for this batch'), 'error');
    }
  };

  if (loading) return <Spinner centered />;
  if (error) return <ErrorState centered message={error} onRetry={retry} />;

  return (
    <div className="page-section">
      <PageHeader title="Assignments" />

      <Card className="step-card sticky top-[calc(var(--navbar-h)_+_1rem)] z-20">
        <CardHeader
          title="Select batch & assignment"
          action={selectedBatch && (
            <div className="flex gap-2">
              {selectedAssignment && (
                <Button size="sm" variant="secondary" className="action-button-icon" onClick={() => setShowEdit(true)} aria-label="Edit assignment">
                  <Edit3 size={14} />
                </Button>
              )}
              <Button size="sm" className="action-button-compact" onClick={() => setShowNew(true)}><Plus size={14} /> New Assignment</Button>
            </div>
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Batch">
            <BatchSelect batches={batches} value={selectedBatch} onChange={fetchBatchData} />
          </FormField>
          <FormField label="Assignment">
            {!selectedBatch ? (
              <FieldNotice>Select a batch first</FieldNotice>
            ) : assignments.length === 0 ? (
              <FieldNotice>No assignments yet — create one</FieldNotice>
            ) : (
              <AssignmentSelect assignments={assignments} value={selectedAsgn} onChange={setSelectedAsgn} />
            )}
          </FormField>
        </div>
      </Card>

      {selectedBatch && selectedAsgn && (
        <Card>
          <AssignmentFiles key={selectedAsgn} assignmentId={selectedAsgn} batchId={selectedBatch} />
        </Card>
      )}

      {selectedBatch && selectedAsgn && (
        <Card>
          <AssignmentSubmissionTable
            key={selectedAsgn}
            assignmentId={selectedAsgn}
            batchId={selectedBatch}
            assignmentTitle={selectedAssignment?.title ?? 'assignment'}
            dueAt={selectedAssignment?.due_at}
          />
        </Card>
      )}

      {selectedBatch && (
        <NewAssignmentModal
          key={showEdit ? (selectedAsgn ?? 'edit') : 'new'}
          open={showNew || showEdit}
          onClose={() => { setShowNew(false); setShowEdit(false); }}
          batchId={selectedBatch}
          assignment={showEdit ? selectedAssignment : undefined}
          onSaved={() => fetchBatchData(selectedBatch)}
        />
      )}
    </div>
  );
}
