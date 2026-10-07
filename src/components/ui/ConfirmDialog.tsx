import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Modal } from '@/components/ui/Modal';
import { useConfirmState } from '@/lib/context/ConfirmContext';

type Step = 'review' | 'check' | 'type';

// Renders what useConfirm() last asked for; impact or requireCheck makes it a stepped flow
export function ConfirmDialog() {
  const { state, resolve } = useConfirmState();
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState(false);

  const staged = Boolean(state.impact || state.requireCheck);
  const steps: Step[] = staged
    ? ['review', ...(state.requireCheck ? ['check' as const] : []), ...(state.requireText ? ['type' as const] : [])]
    : ['review'];
  const current = steps[Math.min(step, steps.length - 1)];
  const last = step >= steps.length - 1;

  const reset = () => {
    setStep(0);
    setTyped('');
    setChecked(false);
  };
  const settle = (accepted: boolean) => {
    reset();
    resolve(accepted);
  };
  const back = () => {
    if (current === 'type') setTyped('');
    if (current === 'check') setChecked(false);
    setStep(step - 1);
  };

  // Each step unlocks only when its own ask is done
  const asksText = Boolean(state.requireText) && (current === 'type' || !staged);
  const locked = (current === 'check' && !checked) || (asksText && typed.trim() !== state.requireText);

  return (
    <Modal
      open={state.open}
      onClose={() => settle(false)}
      title={state.title}
      footer={
        <>
          <Button variant="ghost" onClick={() => (step === 0 ? settle(false) : back())}>
            {step === 0 ? state.cancelLabel ?? 'Cancel' : 'Back'}
          </Button>
          {last ? (
            <Button
              className="action-button-compact"
              variant={state.danger ? 'danger' : 'primary'}
              onClick={() => settle(true)}
              disabled={locked}
            >
              {state.confirmLabel ?? 'Confirm'}
            </Button>
          ) : (
            <Button className="action-button-compact" variant={state.danger ? 'danger' : 'primary'} onClick={() => setStep(step + 1)} disabled={locked}>
              Continue
            </Button>
          )}
        </>
      }
    >
      <div className="popup-form-spaced">
        {steps.length > 1 && <p className="text-xs text-[var(--text-muted)]">Step {step + 1} of {steps.length}</p>}

        {current === 'review' && (
          <>
            <div className="confirm-body">
              {state.danger && (
                <span className="confirm-icon">
                  <AlertTriangle size={18} aria-hidden="true" />
                </span>
              )}
              {state.message && <p className="confirm-message">{state.message}</p>}
            </div>
            {state.impact && state.impact.length > 0 && (
              <div className="flex flex-col gap-2">
                {state.impact.map(({ label, count }) => (
                  <div key={label} className="flex items-baseline justify-between gap-6 text-sm">
                    <span className="text-[var(--text-muted)]">{label}</span>
                    <span className="font-semibold tabular-nums text-[var(--text-primary)]">{count}</span>
                  </div>
                ))}
              </div>
            )}
            {state.alt && (
              <div>
                <Button
                  className="action-button-compact"
                  variant="secondary"
                  onClick={() => {
                    const { onSelect } = state.alt!;
                    settle(false);
                    onSelect();
                  }}
                >
                  {state.alt.label}
                </Button>
              </div>
            )}
          </>
        )}

        {current === 'check' && state.requireCheck && (
          <label className={`repo-confirm ${checked ? 'is-checked' : ''}`}>
            <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
            {state.requireCheck}
          </label>
        )}

        {asksText && (
          <FormField label={`Type ${state.requireText} to confirm`} required>
            <input
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              aria-label={`Type ${state.requireText} to confirm`}
            />
          </FormField>
        )}
      </div>
    </Modal>
  );
}
