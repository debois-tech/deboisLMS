import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useConfirmState } from '@/lib/context/ConfirmContext';

/** Renders whatever `useConfirm()` last asked for. Mounted once, next to `ToastContainer`. */
export function ConfirmDialog() {
  const { state, resolve } = useConfirmState();

  return (
    <Modal
      open={state.open}
      onClose={() => resolve(false)}
      title={state.title}
      footer={
        <>
          <Button variant="ghost" onClick={() => resolve(false)}>
            {state.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            className="action-button-compact"
            variant={state.danger ? 'danger' : 'primary'}
            onClick={() => resolve(true)}
          >
            {state.confirmLabel ?? 'Confirm'}
          </Button>
        </>
      }
    >
      <div className="confirm-body">
        {state.danger && (
          <span className="confirm-icon">
            <AlertTriangle size={18} aria-hidden="true" />
          </span>
        )}
        {state.message && <p className="confirm-message">{state.message}</p>}
      </div>
    </Modal>
  );
}
