import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useToast } from '@/lib/context/ToastContext';
import { getTutorBatchFootprints, removeTutorFromBatch, type TutorBatchFootprint } from '@/lib/supabase';
import type { Batch, TutorBatchMapping } from '@/lib/types';
import { errorMessage } from '@/lib/utils/errors';
import { formatDate } from '@/lib/utils/format';

type Row = TutorBatchMapping & { batch?: Batch };
type Choice = 'keep' | 'delete';

interface Props {
  open: boolean;
  onClose: () => void;
  tutorName: string;
  batches: Row[];
  onDone: () => void;
}

// What happens to the tutor's work in each batch, then a guarded review; mounted fresh on every open.
export function UnassignWizard({ open, onClose, tutorName, batches, onDone }: Props) {
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [prints, setPrints] = useState<Map<string, TutorBatchFootprint> | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const { showToast } = useToast();

  useEffect(() => {
    if (!open) return;
    let live = true;
    getTutorBatchFootprints(batches.map((batch) => batch.id))
      .then((rows) => live && setPrints(new Map(rows.map((row) => [row.mapping_id, row]))))
      .catch((err) => {
        showToast(errorMessage(err, 'Could not load what this tutor holds'), 'error');
        onClose();
      });
    return () => { live = false; };
  }, [open, batches, showToast, onClose]);

  const choiceOf = (batch: Row) => choices[batch.id] ?? 'keep';

  const review = async () => {
    const erased = batches.filter((batch) => choiceOf(batch) === 'delete');
    const filesLost = erased.reduce((sum, batch) => {
      const print = prints?.get(batch.id);
      return sum + (print ? print.materials + print.images : 0);
    }, 0);
    setConfirming(true);
    const accepted = await confirm({
      title: batches.length === 1
        ? `Unassign ${tutorName} from ${batches[0].batch?.name ?? 'this batch'}?`
        : `Unassign ${tutorName} from ${batches.length} batches?`,
      message: (
        <>
          <span className="block">The tutor record and login stay</span>
          <span className="block">
            {erased.length > 0
              ? 'Kept work stays in the batch, hidden from them. Deleted work goes for good'
              : 'Their work stays in the batch, hidden from them'}
          </span>
          <span className="block">Only this assignment is removed</span>
        </>
      ),
      impact: [
        { label: 'Batches unassigned', count: batches.length },
        ...(erased.length > 0
          ? [
              { label: 'Batches where their work is erased', count: erased.length },
              { label: 'Files erased', count: filesLost },
            ]
          : []),
      ],
      confirmLabel: 'Unassign',
      danger: true,
      requireCheck: 'Yes, unassign this tutor',
      requireText: 'REMOVE',
    });
    setConfirming(false);
    if (!accepted) return;

    setBusy(true);
    const failures: string[] = [];
    for (const batch of batches) {
      try {
        await removeTutorFromBatch(batch.id, choiceOf(batch) === 'delete');
      } catch (err) {
        failures.push(`${batch.batch?.name ?? 'batch'}: ${errorMessage(err, 'failed')}`);
      }
    }
    setBusy(false);
    const done = batches.length - failures.length;
    showToast(
      failures.length === 0 ? `${done} ${done === 1 ? 'batch' : 'batches'} unassigned` : `Unassigned ${done} of ${batches.length}. ${failures[0]}`,
      failures.length === 0 ? 'success' : 'error',
    );
    onDone();
  };

  return (
    <Modal
      open={open && !confirming}
      onClose={busy ? () => {} : onClose}
      title={`Unassign ${tutorName}`}
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
          {batches.map((batch) => {
            const print = prints.get(batch.id);
            const holds = print
              ? `${print.materials} files · ${print.quizzes} quizzes · ${print.badges} badges given · ${print.curriculum} requests · ${print.actions} log entries`
              : 'Nothing recorded';
            return (
              <div key={batch.id} className="remove-card">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)]">{batch.batch?.name ?? 'Batch'}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Assigned {formatDate(batch.assigned_at)} · {holds}
                  </p>
                </div>
                <div className="feedback-kinds" role="group" aria-label={`What happens to the tutor's work in ${batch.batch?.name ?? 'this batch'}`}>
                  {(['keep', 'delete'] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={choiceOf(batch) === value}
                      onClick={() => setChoices({ ...choices, [batch.id]: value })}
                      className={clsx('feedback-kind', choiceOf(batch) === value && 'is-active')}
                    >
                      {value === 'keep' ? 'Keep work' : 'Delete work'}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <p className="field-hint">Keep: their materials, quizzes, badges and log entries stay in the batch, hidden from them. Delete: everything they made for this batch is erased, files too.</p>
        </div>
      )}
    </Modal>
  );
}
