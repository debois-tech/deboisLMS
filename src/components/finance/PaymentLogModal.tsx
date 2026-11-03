import { useEffect, useRef, useState } from 'react';
import { Plus, Receipt, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { ClaimActions } from '@/components/finance/ClaimActions';
import { downloadFeeReceipt, getPendingClaims } from '@/lib/supabase';
import { useToast } from '@/lib/context/ToastContext';
import { errorMessage } from '@/lib/utils/errors';
import { fromDateValue } from '@/lib/utils/date';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { DatePicker } from '@/components/ui/DatePicker';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import type { StudentFee, FeePaymentLog, PaymentClaim, PaymentMethod, Student } from '@/lib/types';
import { formatCurrency } from '@/lib/utils/format';
import { REGISTRATION_NOTE } from '@/lib/utils/installments';

export interface PaymentLogFormState {
  amount: string;
  payment_date: string;
  payment_method: PaymentMethod;
  notes: string;
}

const METHOD_LABEL: Record<PaymentMethod, string> = { cash: 'Cash', upi: 'UPI', bank_transfer: 'Bank transfer', other: 'Other' };

interface PaymentLogModalProps {
  fee: StudentFee | null;
  studentName: string;
  /** Fills the fee receipt; without it the receipt buttons are not shown. */
  student?: Student;
  batchName?: string;
  paymentLogs: FeePaymentLog[];
  form: PaymentLogFormState;
  onFormChange: (form: PaymentLogFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  onDelete: (log: FeePaymentLog) => void;
  /** Id of the log currently being removed, so only its own button spins. */
  deletingId?: string | null;
  /** A pending claim was verified: the new log and updated fee, for the parent to fold in. */
  onClaimApproved: (result: { log: FeePaymentLog; fee: StudentFee }) => void;
}

export function PaymentLogModal({
  fee, studentName, student, batchName, paymentLogs, form, onFormChange, onClose, onSubmit, submitting, onDelete, deletingId, onClaimApproved,
}: PaymentLogModalProps) {
  const [claims, setClaims] = useState<PaymentClaim[]>([]);
  const [printing, setPrinting] = useState<string | null>(null);
  const { showToast } = useToast();

  const studentId = fee?.student_id;

  useEffect(() => {
    if (!studentId) return;
    let live = true;
    getPendingClaims(studentId).then((c) => { if (live) setClaims(c); }).catch(console.error);
    return () => { live = false; };
  }, [studentId]);

  // A log added from the form (or an approved claim) scrolls the table into view; opening the modal does not.
  const logsRef = useRef<HTMLDivElement>(null);
  const before = useRef<number | null>(null);
  useEffect(() => {
    before.current = null;
  }, [studentId]);
  useEffect(() => {
    if (submitting) before.current = paymentLogs.length;
    else if (before.current !== null && paymentLogs.length > before.current) {
      before.current = null;
      logsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [submitting, paymentLogs.length]);

  // A receipt shows the fee as it stood on that payment: every payment up to and including it, oldest first.
  const printReceipt = async (log: FeePaymentLog) => {
    if (!student || !fee) return;
    setPrinting(log.id);
    try {
      const ordered = [...paymentLogs].sort((a, b) => a.payment_date.localeCompare(b.payment_date) || a.created_at.localeCompare(b.created_at));
      let numbered = 0;
      await downloadFeeReceipt({
        receiptNo: student.student_code ?? '',
        date: fromDateValue(log.payment_date) ?? new Date(),
        name: student.name.trim(),
        programme: batchName ?? '',
        email: student.email ?? '',
        phone: student.phone,
        rows: ordered.slice(0, ordered.findIndex((entry) => entry.id === log.id) + 1).map((entry) => ({
          label: entry.notes === REGISTRATION_NOTE ? 'Registration fee' : `Programme fee - Payment ${++numbered}`,
          date: fromDateValue(entry.payment_date) ?? new Date(),
          amount: Number(entry.amount),
        })),
        totalFee: fee.total_fee,
        mode: METHOD_LABEL[log.payment_method ?? 'other'],
        txn: null, // the transaction id is not wired in yet
      });
    } catch (err) {
      showToast(errorMessage(err, 'Could not build the receipt'), 'error');
    } finally {
      setPrinting(null);
    }
  };

  // Filtered on render so a previous student's claims never flash on open.
  const shownClaims = fee ? claims.filter((c) => c.student_id === fee.student_id && c.batch_id === fee.batch_id) : [];
  const left = fee?.status === 'terminated';
  const remaining = fee
    ? Math.max(0, (left ? Number(fee.expected_on_exit) : fee.total_fee) - fee.paid_amount)
    : 0;
  // Instalments themselves are flexible — 6k then 4k settles the same 10k — so the
  // ceiling is the balance, never one instalment. Nobody pays past what they owe:
  // for a student who left that is the void, not the fee they never reached.
  const overpaying = Number(form.amount) > remaining;

  return (
    <Modal open={!!fee} onClose={onClose} title="Payment Log" size="xl">
      {fee && (
        <div className="space-y-6">
          <div className="payment-log-form popup-form-spaced">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="Student">
                <div className="display-field">{studentName}</div>
              </FormField>
              <FormField label="Paid">
                <div className="display-field text-[var(--success-text)]">{formatCurrency(fee.paid_amount)}</div>
              </FormField>
              <FormField label={left ? 'Void' : 'Remaining'}>
                <div className={`display-field ${remaining > 0 ? (left ? 'text-[var(--warning-text)]' : 'text-[var(--danger-text)]') : 'text-[var(--success-text)]'}`}>
                  {remaining > 0 ? formatCurrency(remaining) : left ? 'Nothing void' : 'Paid in full'}
                </div>
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Amount (₹)" required>
                <input
                  type="number"
                  min="1"
                  max={remaining}
                  value={form.amount}
                  onChange={(event) => onFormChange({ ...form, amount: event.target.value })}
                />
                {overpaying && <InlineAlert>Max {formatCurrency(remaining)}</InlineAlert>}
              </FormField>
              <FormField label="Payment Date" required>
                <DatePicker
                  value={form.payment_date}
                  onChange={(payment_date) => onFormChange({ ...form, payment_date })}
                  placeholder="Pick a date"
                  ariaLabel="Payment date"
                  clearable={false}
                />
              </FormField>
            </div>
            <FormField label="Payment Method">
              <SearchSelect
                options={[
                  { value: 'cash', label: 'Cash' },
                  { value: 'upi', label: 'UPI' },
                  { value: 'bank_transfer', label: 'Bank transfer' },
                  { value: 'other', label: 'Other' },
                ]}
                value={form.payment_method}
                onChange={(payment_method) => onFormChange({ ...form, payment_method: payment_method as PaymentMethod })}
                placeholder="Select payment method"
                searchPlaceholder="Search payment methods"
                emptyText="No payment methods found"
              />
            </FormField>
            <FormField label="Notes">
              <textarea value={form.notes} onChange={(event) => onFormChange({ ...form, notes: event.target.value })} />
            </FormField>
            <div className="flex justify-end">
              <Button className="action-button-compact" onClick={onSubmit} loading={submitting} disabled={!form.amount || Number(form.amount) <= 0 || overpaying}>
                <Plus size={14} /> Add Log
              </Button>
            </div>
          </div>

          <hr className="divider m-0" />

          <div ref={logsRef}>
            <div className="mb-6 text-sm font-semibold text-[var(--text-primary)]">Logs</div>
            {paymentLogs.length === 0 && shownClaims.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No payment logs yet.</p>
            ) : (
              <Table maxHeight="16rem">
                <THead>
                  <TR>
                    <TH>Amount</TH>
                    <TH>Date</TH>
                    <TH>Method</TH>
                    <TH>Notes</TH>
                    <TH>Status</TH>
                    <TH> </TH>
                  </TR>
                </THead>
                <TBody>
                  {shownClaims.map((claim) => (
                    <TR key={claim.id}>
                      <TD className="font-semibold text-[var(--warning-text)]">{formatCurrency(Number(claim.amount))}</TD>
                      <TD className="cell-secondary">{claim.created_at.slice(0, 10)}</TD>
                      <TD className="cell-muted">UPI</TD>
                      <TD className="cell-muted">Student claim · Txn {claim.transaction_id}</TD>
                      <TD><Badge variant="warning" dot>Unverified</Badge></TD>
                      <TD className="w-px">
                        <ClaimActions
                          claim={claim}
                          name={studentName}
                          onDone={(done, result) => {
                            setClaims((prev) => prev.filter((c) => c.id !== done.id));
                            if (result) onClaimApproved(result);
                          }}
                        />
                      </TD>
                    </TR>
                  ))}
                  {paymentLogs.map((log) => (
                    <TR key={log.id}>
                      <TD className="font-semibold text-[var(--success-text)]">{formatCurrency(Number(log.amount))}</TD>
                      <TD className="cell-secondary">{log.payment_date}</TD>
                      <TD className="cell-muted capitalize">{(log.payment_method ?? '—').replace('_', ' ')}</TD>
                      <TD className="cell-muted">{log.notes || '—'}</TD>
                      <TD><Badge variant="success" dot>Verified</Badge></TD>
                      <TD className="w-px">
                        <div className="flex items-center justify-end gap-1">
                          {student && (
                            <Button
                              variant="ghost"
                              className="action-button-compact"
                              onClick={() => void printReceipt(log)}
                              loading={printing === log.id}
                              aria-label={`Download the receipt for the ${formatCurrency(Number(log.amount))} payment from ${log.payment_date}`}
                            >
                              <Receipt size={14} />
                            </Button>
                          )}
                          {/* The registration fee is written by a trigger, so nothing could put it back. */}
                          {log.notes !== REGISTRATION_NOTE && (
                            <Button
                              variant="ghost"
                              className="action-button-compact action-button-danger"
                              onClick={() => onDelete(log)}
                              loading={deletingId === log.id}
                              aria-label={`Delete the ${formatCurrency(Number(log.amount))} payment from ${log.payment_date}`}
                            >
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
