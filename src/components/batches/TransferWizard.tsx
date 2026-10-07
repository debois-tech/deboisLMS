import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { EarlierWorkTick } from '@/components/batches/EarlierWorkTick';
import { BatchSelect } from '@/components/ui/BatchSelect';
import { DatePicker } from '@/components/ui/DatePicker';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Modal } from '@/components/ui/Modal';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Spinner } from '@/components/ui/Spinner';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { useToast } from '@/lib/context/ToastContext';
import { getFeesByBatch, transferStudent } from '@/lib/supabase';
import { getAllPendingClaims } from '@/lib/supabase/queries/paymentClaims';
import type { Batch, BatchStudentMapping, Student, StudentFee } from '@/lib/types';
import { errorMessage } from '@/lib/utils/errors';
import { formatCurrency, formatDate } from '@/lib/utils/format';

type Row = Student & { mapping: BatchStudentMapping };

const FEE_MODES = [
  { value: 'same', label: 'Same fee for all' },
  { value: 'each', label: 'One by one' },
];

interface TransferWizardProps {
  open: boolean;
  onClose: () => void;
  source: Batch;
  students: Row[];
  targets: Batch[];
  onDone: () => void;
}

// Where to, what each student pays there, then a guarded review; mounted fresh on every open
export function TransferWizard({ open, onClose, source, students, targets, onDone }: TransferWizardProps) {
  const [step, setStep] = useState(0);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [joinedOn, setJoinedOn] = useState('');
  const [countEarlier, setCountEarlier] = useState(true);
  const [carry, setCarry] = useState(false);
  const [mode, setMode] = useState<'same' | 'each'>('same');
  const [sameFee, setSameFee] = useState('');
  const [fees, setFees] = useState<Record<string, string>>({});
  const [feeRows, setFeeRows] = useState<Map<string, StudentFee> | null>(null);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const confirm = useConfirm();
  const { showToast } = useToast();

  useEffect(() => {
    if (!open) return;
    let live = true;
    Promise.all([getFeesByBatch(source.id), getAllPendingClaims()])
      .then(([feeList, claims]) => {
        if (!live) return;
        setFeeRows(new Map(feeList.map((fee) => [fee.student_id, fee])));
        const ids = new Set(claims.filter((claim) => claim.batch_id === source.id).map((claim) => claim.student_id));
        setBlocked(students.filter((s) => ids.has(s.id)).map((s) => s.name));
      })
      .catch((err) => showToast(errorMessage(err, 'Could not load the fees'), 'error'));
    return () => { live = false; };
  }, [open, source.id, students, showToast]);

  const target = targets.find((batch) => batch.id === targetId);
  const feeOf = (student: Row) => (mode === 'same' ? sameFee : fees[student.id] ?? '');
  const paidOf = (student: Row) => feeRows?.get(student.id)?.paid_amount ?? 0;

  const feeError = (student: Row) => {
    const value = feeOf(student).trim();
    if (value === '' || !(Number(value) >= 0)) return 'Enter a fee';
    if (target?.base_fee != null && Number(value) > target.base_fee) return `Above base ${formatCurrency(target.base_fee)}`;
    if (carry && Number(value) < paidOf(student)) return `Below paid ${formatCurrency(paidOf(student))}`;
    return '';
  };
  const feesReady = feeRows !== null && blocked.length === 0 && students.every((student) => feeError(student) === '');

  const review = async () => {
    if (!target) return;
    setConfirming(true);
    const carried = carry ? students.reduce((sum, student) => sum + paidOf(student), 0) : 0;
    const docs = students.reduce((count, student) => count + (student.mapping.offer_letter_path ? 1 : 0) + (student.mapping.cert_path ? 1 : 0), 0);
    const accepted = await confirm({
      title: `Transfer ${students.length === 1 ? students[0].name : `${students.length} students`} to ${target.name}?`,
      message: (
        <>
          <span className="block">Old batch data stays, read-only</span>
          <span className="block">{carry ? 'Payments copied here, no longer counted in the old batch' : 'Old payments stay frozen in the old batch, Rs 1,000 registration booked here'}</span>
          <span className="block">{joinedOn ? `Join date ${formatDate(joinedOn)}` : 'Join date by the first-week rule'}</span>
          <span className="block">Cannot be undone</span>
        </>
      ),
      impact: [
        { label: 'Students moved', count: students.length },
        ...(docs > 0 ? [{ label: 'Documents deleted', count: docs }] : []),
        ...(carry ? [{ label: 'Rupees carried over', count: carried }] : []),
      ],
      confirmLabel: 'Transfer',
      danger: true,
      requireCheck: 'Yes, transfer these students',
      requireText: 'TRANSFER',
    });
    setConfirming(false);
    if (!accepted) return;

    setRunning(true);
    const failures: string[] = [];
    for (const student of students) {
      try {
        await transferStudent(student.mapping.id, target.id, Number(feeOf(student)), carry, joinedOn || undefined, countEarlier);
      } catch (err) {
        failures.push(`${student.name}: ${errorMessage(err, 'failed')}`);
      }
    }
    setRunning(false);
    const moved = students.length - failures.length;
    showToast(
      failures.length === 0 ? `${moved} moved to ${target.name}` : `Moved ${moved} of ${students.length}. ${failures[0]}`,
      failures.length === 0 ? 'success' : 'error',
    );
    onDone();
  };

  return (
    <Modal
      open={open && !confirming}
      onClose={running ? () => {} : onClose}
      title="Transfer students"
      footer={
        <>
          <Button variant="ghost" onClick={step === 0 ? onClose : () => setStep(0)} disabled={running}>{step === 0 ? 'Cancel' : 'Back'}</Button>
          {step === 0 ? (
            <Button className="action-button-compact" onClick={() => setStep(1)} disabled={!target}>Continue</Button>
          ) : (
            <Button className="action-button-compact" onClick={() => void review()} disabled={!feesReady} loading={running}>Review</Button>
          )}
        </>
      }
    >
      <div className="popup-form-spaced">
        <p className="text-xs text-[var(--text-muted)]">Step {step + 1} of 3</p>

        {step === 0 && (
          <>
            <FormField label="Move to">
              <BatchSelect batches={targets} value={targetId} onChange={setTargetId} />
            </FormField>
            {targets.length === 0 && <InlineAlert>No other running batch to move to</InlineAlert>}
            <FormField label="Join date">
              <DatePicker value={joinedOn} onChange={setJoinedOn} placeholder="By the first-week rule" ariaLabel="Join date" />
            </FormField>
            <EarlierWorkTick batch={target} checked={countEarlier} onChange={setCountEarlier} />
          </>
        )}

        {step === 1 && (
          feeRows === null ? <Spinner centered /> : (
            <>
              {blocked.length > 0 && <InlineAlert>Clear the payment claims of {blocked.join(', ')} first</InlineAlert>}
              <label className={`repo-confirm ${carry ? 'is-checked' : ''}`}>
                <input type="checkbox" checked={carry} onChange={(event) => setCarry(event.target.checked)} />
                Carry their payments over to {target?.name ?? 'the new batch'}
              </label>
              {students.length > 1 && (
                <SearchSelect
                  options={FEE_MODES}
                  value={mode}
                  onChange={(value) => setMode(value as 'same' | 'each')}
                  placeholder="Fee"
                  searchPlaceholder=""
                  emptyText=""
                  showSearch={false}
                />
              )}
              {mode === 'same' ? (
                <FormField label={`Fee at ${target?.name ?? 'the new batch'}`} required>
                  <input type="number" min="0" max={target?.base_fee ?? undefined} value={sameFee} onChange={(event) => setSameFee(event.target.value)} />
                  {students.map((student) => feeError(student) && (
                    <p key={student.id} className="field-flag">{student.name}: {feeError(student)}</p>
                  ))}
                </FormField>
              ) : (
                students.map((student) => (
                  <FormField key={student.id} label={`${student.name} · paid ${formatCurrency(paidOf(student))} of ${formatCurrency(feeRows.get(student.id)?.total_fee ?? 0)}`} required>
                    <input
                      type="number"
                      min="0"
                      max={target?.base_fee ?? undefined}
                      value={fees[student.id] ?? ''}
                      onChange={(event) => setFees({ ...fees, [student.id]: event.target.value })}
                      aria-invalid={feeOf(student) !== '' && feeError(student) !== ''}
                    />
                    {feeOf(student) !== '' && feeError(student) && <p className="field-flag">{feeError(student)}</p>}
                  </FormField>
                ))
              )}
              {target?.base_fee != null && <p className="field-hint">Base fee {formatCurrency(target.base_fee)}</p>}
            </>
          )
        )}
      </div>
    </Modal>
  );
}
