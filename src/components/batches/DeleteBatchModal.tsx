import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Spinner } from '@/components/ui/Spinner';
import { deleteBatch, getBatchDeletionCounts, type BatchDeletionCounts } from '@/lib/supabase';
import { useToast } from '@/lib/context/ToastContext';
import { errorMessage } from '@/lib/utils/errors';

interface DeleteBatchModalProps {
  open: boolean;
  batchId: string;
  batchName: string;
  // Typed back by the admin to unlock the delete.
  confirmWord: string;
  onClose: () => void;
  onDeleted: () => void;
}

const LABELS: [keyof BatchDeletionCounts, string][] = [
  ['students', 'Enrolments'],
  ['fees', 'Fee records'],
  ['payments', 'Payment logs'],
  ['lectures', 'Lectures'],
  ['attendance', 'Attendance records'],
  ['assignments', 'Assignments'],
  ['materials', 'Files'],
  ['tutors', 'Tutor assignments'],
];

export function DeleteBatchModal({
  open, batchId, batchName, confirmWord, onClose, onDeleted,
}: DeleteBatchModalProps) {
  const [counts, setCounts] = useState<BatchDeletionCounts | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const { showToast } = useToast();

  // Remounted on open by a key at the call site, so there is nothing to reset here.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getBatchDeletionCounts(batchId)
      .then((result) => { if (!cancelled) setCounts(result); })
      .catch((err) => showToast(errorMessage(err, 'Could not read what would be deleted'), 'error'));
    return () => { cancelled = true; };
  }, [open, batchId, showToast]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteBatch(batchId);
      showToast(`${batchName} deleted`);
      onDeleted();
    } catch (err) {
      showToast(errorMessage(err, 'Could not delete this batch'), 'error');
    }
    setDeleting(false);
  };

  const rows = counts ? LABELS.filter(([key]) => counts[key] > 0) : [];
  const matches = typed.trim() === confirmWord;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === 1 ? `Delete ${batchName}?` : 'This cannot be undone'}
      size="sm"
      footer={
        step === 1 ? (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="danger" onClick={() => setStep(2)} disabled={!counts}>Continue</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStep(1)} disabled={deleting}>Back</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting} disabled={!matches}>
              Delete forever
            </Button>
          </>
        )
      }
    >
      {step === 1 ? (
        !counts ? (
          <Spinner centered />
        ) : (
          <div className="flex flex-col gap-4">
            {rows.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Nothing is attached to this batch.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {rows.map(([key, label]) => (
                  <div key={key} className="flex items-baseline justify-between gap-6 text-sm">
                    <span className="text-[var(--text-muted)]">{label}</span>
                    <span className="font-semibold tabular-nums text-[var(--text-primary)]">{counts[key]}</span>
                  </div>
                ))}
              </div>
            )}
            <InlineAlert>Deleted from the database and the file storage.</InlineAlert>
          </div>
        )
      ) : (
        <FormField label={`Type ${confirmWord} to confirm`} required>
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            aria-label={`Type ${confirmWord} to confirm deletion`}
          />
        </FormField>
      )}
    </Modal>
  );
}
