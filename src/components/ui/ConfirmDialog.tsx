import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Modal } from '@/components/ui/Modal';
import { useConfirmState } from '@/lib/context/ConfirmContext';

/** Renders whatever `useConfirm()` last asked for. Mounted once, next to `ToastContainer`. */
export function ConfirmDialog() {
  const { state, resolve } = useConfirmState();
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState(false);

  const settle = (accepted: boolean) => {
    setTyped('');
    setChecked(false);
    resolve(accepted);
  };

  return (
    <Modal
      open={state.open}
      onClose={() => settle(false)}
      title={state.title}
      footer={
        <>
          <Button variant="ghost" onClick={() => settle(false)}>
            {state.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            className="action-button-compact"
            variant={state.danger ? 'danger' : 'primary'}
            onClick={() => settle(true)}
            disabled={(Boolean(state.requireCheck) && !checked) || (Boolean(state.requireText) && typed.trim() !== state.requireText)}
          >
            {state.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    >
      <div className="popup-form-spaced">
        <div className="confirm-body">
          {state.danger && (
            <span className="confirm-icon">
              <AlertTriangle size={18} aria-hidden="true" />
            </span>
          )}
          {state.message && <p className="confirm-message">{state.message}</p>}
        </div>
        {state.requireCheck && (
          <label className={`repo-confirm ${checked ? 'is-checked' : ''}`}>
            <input type="checkbox" checked={checked} onChange={(event) => setChecked(event.target.checked)} />
            {state.requireCheck}
          </label>
        )}
        {state.requireText && (!state.requireCheck || checked) && (
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
