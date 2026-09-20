import { useState } from 'react';
import { QrCode } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { getPaymentQrUrl, submitPaymentClaim } from '@/lib/supabase';

interface PaymentClaimModalProps {
  open: boolean;
  studentId: string;
  batchId?: string;
  dueAmount?: number;
  onClose: () => void;
  onSubmitted: () => void;
}

/** Scan, pay, then tell us — so the office isn't fielding "send me the QR" every time. Not a confirmed payment. */
export function PaymentClaimModal({ open, studentId, batchId, dueAmount, onClose, onSubmitted }: PaymentClaimModalProps) {
  const [transactionId, setTransactionId] = useState('');
  const [amount, setAmount] = useState(dueAmount ? String(dueAmount) : '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [qrFailed, setQrFailed] = useState(false);
  const qrUrl = getPaymentQrUrl();

  const reset = () => {
    setTransactionId('');
    setAmount(dueAmount ? String(dueAmount) : '');
    setError('');
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleAmountChange = (value: string) => {
    setAmount(dueAmount && Number(value) > dueAmount ? String(dueAmount) : value);
    setError('');
  };

  const handleSubmit = async () => {
    const trimmedId = transactionId.trim();
    const parsedAmount = Number(amount);
    if (!trimmedId) return setError('Enter the transaction ID.');
    if (!(parsedAmount > 0)) return setError('Enter a valid amount.');
    if (dueAmount && parsedAmount > dueAmount) return setError('Amount can’t exceed what you owe.');

    setSubmitting(true);
    setError('');
    try {
      await submitPaymentClaim(studentId, batchId, trimmedId, parsedAmount);
      reset();
      onSubmitted();
    } catch (err) {
      console.error(err);
      setError('Could not submit. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Pay"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose} disabled={submitting}>Cancel</Button>
          <Button className="action-button-compact" onClick={handleSubmit} loading={submitting}>
            Submit
          </Button>
        </>
      }
    >
      <div className="payment-claim-layout">
        {qrFailed ? (
          <div className="payment-qr-placeholder">
            <QrCode size={40} aria-hidden="true" />
            <span>QR code coming soon</span>
          </div>
        ) : (
          <img
            src={qrUrl}
            alt="Payment QR code"
            className="payment-qr-image"
            onError={() => setQrFailed(true)}
          />
        )}

        <div className="repo-submit-row">
          {error && <InlineAlert>{error}</InlineAlert>}

          <FormField label="UPI Transaction ID" required>
            <input
              value={transactionId}
              onChange={(e) => { setTransactionId(e.target.value); setError(''); }}
              placeholder="e.g. UPI reference number"
              autoComplete="off"
              disabled={submitting}
            />
          </FormField>

          <FormField label="Amount paid" required>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max={dueAmount || undefined}
              step="0.01"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0"
              disabled={submitting}
            />
          </FormField>

          <p className="text-xs text-[var(--text-muted)]">Please also share the payment screenshot on WhatsApp.</p>
        </div>
      </div>
    </Modal>
  );
}
