import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Spinner } from '@/components/ui/Spinner';
import { deleteStudent, getStudentDeletionCounts, type StudentDeletionCounts } from '@/lib/supabase';
import { useToast } from '@/lib/context/ToastContext';
import { errorMessage } from '@/lib/utils/errors';

interface DeleteStudentModalProps {
  open: boolean;
  studentId: string;
  studentName: string;
  // Typed back by the admin to unlock the delete.
  confirmWord: string;
  onClose: () => void;
  onDeleted: () => void;
}

const LABELS: [keyof StudentDeletionCounts, string][] = [
  ['batches', 'Enrolments'],
  ['fees', 'Fee records'],
  ['payments', 'Payment logs'],
  ['attendance', 'Attendance records'],
  ['submissions', 'Assignment submissions'],
  ['badges', 'Badges earned'],
  ['claims', 'Payment claims'],
];

export function DeleteStudentModal({
  open, studentId, studentName, confirmWord, onClose, onDeleted,
}: DeleteStudentModalProps) {
  const [counts, setCounts] = useState<StudentDeletionCounts | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const { showToast } = useToast();

  // Remounted on open by a key at the call site, so there is nothing to reset here.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getStudentDeletionCounts(studentId)
      .then((result) => { if (!cancelled) setCounts(result); })
      .catch((err) => showToast(errorMessage(err, 'Could not read what would be deleted'), 'error'));
    return () => { cancelled = true; };
  }, [open, studentId, showToast]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteStudent(studentId);
      showToast(`${studentName} deleted`);
      onDeleted();
    } catch (err) {
      showToast(errorMessage(err, 'Could not delete this student'), 'error');
    }
    setDeleting(false);
  };

  const rows = counts ? LABELS.filter(([key]) => counts[key] > 0) : [];
  const matches = typed.trim() === confirmWord;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === 1 ? `Delete ${studentName}?` : 'This cannot be undone'}
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
              <p className="text-sm text-[var(--text-muted)]">Nothing is attached to this student.</p>
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
            <InlineAlert>Deleted from the database, including their portal login.</InlineAlert>
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
