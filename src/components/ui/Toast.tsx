import { clsx } from 'clsx';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToast } from '@/lib/context/ToastContext';
import type { ToastVariant } from '@/lib/types';

const icons: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (!toasts.length) return null;

  return (
    // `polite` rather than `assertive`: these confirm work that just happened, so
    // they should not interrupt whatever a screen reader is already saying.
    <div className="toast-stack" role="region" aria-live="polite" aria-label="Notifications">
      {toasts.map((toast) => {
        const Icon = icons[toast.variant];
        return (
          <div
            key={toast.id}
            className={clsx('toast', toast.leaving && 'is-leaving')}
            role={toast.variant === 'error' ? 'alert' : 'status'}
          >
            <span className={clsx('toast-icon', `is-${toast.variant}`)}>
              <Icon size={16} aria-hidden="true" />
            </span>

            <p className="toast-message">{toast.message}</p>

            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="toast-close"
              aria-label="Dismiss"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
