import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { approvePaymentClaim, dismissPaymentClaim } from '@/lib/supabase';
import type { FeePaymentLog, PaymentClaim, StudentFee } from '@/lib/types';
import { formatCurrency } from '@/lib/utils/format';
import { useToast } from '@/lib/context/ToastContext';
import { useConfirm } from '@/lib/context/ConfirmContext';
import { errorMessage } from '@/lib/utils/errors';

interface ClaimActionsProps {
  claim: PaymentClaim;
  name: string;
  /** Called once handled; the approval result is passed for a verify, nothing for a dismiss. */
  onDone: (claim: PaymentClaim, result?: { log: FeePaymentLog; fee: StudentFee }) => void;
}

/** Verify or dismiss one pending claim. Verify logs it as a payment. */
export function ClaimActions({ claim, name, onDone }: ClaimActionsProps) {
  const [busy, setBusy] = useState<'verify' | 'dismiss' | null>(null);
  const { showToast } = useToast();
  const confirm = useConfirm();

  const verify = async () => {
    const yes = await confirm({
      title: `Verify ${formatCurrency(Number(claim.amount))} from ${name}?`,
      message: `UPI transaction ${claim.transaction_id}. Confirm it against the bank statement — this logs it as a payment.`,
      confirmLabel: 'Verify',
    });
    if (!yes) return;

    setBusy('verify');
    try {
      onDone(claim, await approvePaymentClaim(claim.id));
      showToast('Payment verified and logged');
    } catch (err) {
      showToast(errorMessage(err, 'Failed to verify this claim'), 'error');
      setBusy(null);
    }
  };

  const dismiss = async () => {
    const yes = await confirm({
      title: `Dismiss ${name}'s ${formatCurrency(Number(claim.amount))} claim?`,
      message: 'Nothing is logged. The claim stays in the export as dismissed.',
      confirmLabel: 'Dismiss',
      danger: true,
    });
    if (!yes) return;

    setBusy('dismiss');
    try {
      await dismissPaymentClaim(claim.id);
      onDone(claim);
      showToast('Claim dismissed');
    } catch (err) {
      showToast(errorMessage(err, 'Failed to dismiss this claim'), 'error');
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" className="action-button-compact" onClick={verify} loading={busy === 'verify'} disabled={busy !== null}>
        <Check size={14} /> Verify
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="action-button-compact action-button-danger"
        onClick={dismiss}
        loading={busy === 'dismiss'}
        disabled={busy !== null}
      >
        Dismiss
      </Button>
    </div>
  );
}
