import { useToast } from '@/lib/context/ToastContext';
import { clsx } from 'clsx';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { ToastVariant } from '@/lib/types';

const icons: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 size={18} className="text-emerald-400" />,
  error:   <XCircle     size={18} className="text-red-400" />,
  warning: <AlertTriangle size={18} className="text-amber-400" />,
  info:    <Info         size={18} className="text-blue-400" />,
};

const borders: Record<ToastVariant, string> = {
  success: 'border-l-emerald-400',
  error:   'border-l-red-400',
  warning: 'border-l-amber-400',
  info:    'border-l-blue-400',
};

export function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            'pointer-events-auto flex items-center gap-3 min-w-[280px] max-w-sm',
            'bg-[var(--bg-elevated)] border border-[var(--border)] border-l-4 rounded-[var(--radius-lg)]',
            'px-4 py-3 shadow-[var(--shadow-lg)] animate-toast-in',
            borders[toast.variant]
          )}
        >
          {icons[toast.variant]}
          <p className="flex-1 text-sm text-[var(--text-primary)]">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
