import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useToast } from '@/lib/context/ToastContext';
import { getEnrolmentFootprints, removeEnrolment, type EnrolmentFootprint } from '@/lib/supabase';
import type { Batch, BatchStudentMapping, Student } from '@/lib/types';
import { errorMessage } from '@/lib/utils/errors';
import { formatCurrency } from '@/lib/utils/format';

type Row = Student & { mapping: BatchStudentMapping };
type Choice = 'keep' | 'delete';

interface Props {
  open: boolean;
  onClose: () => void;
  batch: Batch;
  /** The students ticked in the roster; all of them are in another batch too. */
  students: Row[];
  onDone: () => void;
}

// What happens to each ticked student's data in this batch, then a guarded review; mounted fresh on every open.
export function RemoveWizard({ open, onClose, batch, students, onDone }: Props) {
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [prints, setPrints] = useState<Map<string, EnrolmentFootprint> | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const { showToast } = useToast();

  useEffect(() => {
    if (!open) return;
    let live = true;
    getEnrolmentFootprints(students.map((student) => student.mapping.id))
      .then((rows) => live && setPrints(new Map(rows.map((row) => [row.mapping_id, row]))))
      .catch((err) => {
        showToast(errorMessage(err, 'Could not load what these students hold'), 'error');
        onClose();
      });
    return () => { live = false; };
  }, [open, students, showToast, onClose]);

  const choiceOf = (student: Row) => choices[student.mapping.id] ?? 'keep';

  const review = async () => {
    const erased = students.filter((student) => choiceOf(student) === 'delete');
    const lostRupees = erased.reduce((sum, student) => sum + (prints?.get(student.mapping.id)?.paid ?? 0), 0);
    setConfirming(true);
    const accepted = await confirm({
      title: `Remove ${students.length === 1 ? students[0].name : `${students.length} students`} from ${batch.name}?`,
      message: (
        <>
          <span className="block">They stay in their other batch, with their ref and login</span>
          <span className="block">Documents for this batch are deleted</span>
          <span className="block">Cannot be undone</span>
        </>
      ),
      impact: [
        { label: 'Students removed', count: students.length },
        { label: 'Kept as hidden records', count: students.length - erased.length },
        ...(erased.length > 0 ? [{ label: 'Erased with all their data', count: erased.length }, { label: 'Rupees of payments erased', count: lostRupees }] : []),
      ],
      confirmLabel: 'Remove',
      danger: true,
      requireCheck: 'Yes, remove these students',
      requireText: 'REMOVE',
    });
    setConfirming(false);
    if (!accepted) return;

    setBusy(true);
    const failures: string[] = [];
    for (const student of students) {
      try {
        await removeEnrolment(student.mapping.id, choiceOf(student) === 'delete');
      } catch (err) {
        failures.push(`${student.name}: ${errorMessage(err, 'failed')}`);
      }
    }
    setBusy(false);
    const done = students.length - failures.length;
    showToast(
      failures.length === 0 ? `${done} removed` : `Removed ${done} of ${students.length}. ${failures[0]}`,
      failures.length === 0 ? 'success' : 'error',
    );
    onDone();
  };

  return (
    <Modal
      open={open && !confirming}
      onClose={busy ? () => {} : onClose}
      title="Remove students"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button className="action-button-compact" onClick={() => void review()} disabled={prints === null} loading={busy}>Review</Button>
        </>
      }
    >
      {prints === null ? <Spinner centered /> : (
        <div className="flex flex-col gap-3">
          {students.map((student) => {
            const print = prints.get(student.mapping.id);
            return (
              <div key={student.mapping.id} className="remove-card">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{student.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Paid {formatCurrency(print?.paid ?? 0)} of {formatCurrency(print?.total_fee ?? 0)} · {print?.payments ?? 0} payments · {print?.attendance ?? 0} attendance · {print?.submissions ?? 0} submissions · {print?.badges ?? 0} badges
                  </p>
                </div>
                <div className="feedback-kinds" role="group" aria-label={`What happens to ${student.name}'s data`}>
                  {(['keep', 'delete'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={choiceOf(student) === value}
                      onClick={() => setChoices({ ...choices, [student.mapping.id]: value })}
                      className={clsx('feedback-kind', choiceOf(student) === value && 'is-active')}
                    >
                      {value === 'keep' ? 'Keep record' : 'Delete data'}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <p className="field-hint">Keep: payments and data stay as a hidden record. Delete: everything of this batch is erased.</p>
        </div>
      )}
    </Modal>
  );
}
