import { History, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { DatePicker } from '@/components/ui/DatePicker';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import type { StudentFee, FeePaymentLog, PaymentMethod } from '@/lib/types';
import { formatCurrency } from '@/lib/utils/format';
import { REGISTRATION_NOTE } from '@/lib/utils/installments';

export interface PaymentLogFormState {
  amount: string;
  payment_date: string;
  payment_method: PaymentMethod;
  notes: string;
}

interface PaymentLogModalProps {
  fee: StudentFee | null;
  studentName: string;
  paymentLogs: FeePaymentLog[];
  form: PaymentLogFormState;
  onFormChange: (form: PaymentLogFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  onDelete: (log: FeePaymentLog) => void;
  /** Id of the log currently being removed, so only its own button spins. */
  deletingId?: string | null;
}

export function PaymentLogModal({
  fee, studentName, paymentLogs, form, onFormChange, onClose, onSubmit, submitting, onDelete, deletingId,
}: PaymentLogModalProps) {
  // Only a terminated enrolment has this, so it doubles as the flag for one.
  const left = fee?.expected_on_exit != null;
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

          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
              <History size={15} /> Previous Payments
            </div>
            {paymentLogs.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">No payment logs yet.</p>
            ) : (
              <Table maxHeight="16rem">
                <THead>
                  <TR>
                    <TH>Amount</TH>
                    <TH>Date</TH>
                    <TH>Method</TH>
                    <TH>Notes</TH>
                    <TH> </TH>
                  </TR>
                </THead>
                <TBody>
                  {paymentLogs.map((log) => (
                    <TR key={log.id}>
                      <TD className="font-semibold text-[var(--success-text)]">{formatCurrency(Number(log.amount))}</TD>
                      <TD className="cell-secondary">{log.payment_date}</TD>
                      <TD className="cell-muted capitalize">{(log.payment_method ?? '—').replace('_', ' ')}</TD>
                      <TD className="cell-muted">{log.notes || '—'}</TD>
                      <TD className="w-px">
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
