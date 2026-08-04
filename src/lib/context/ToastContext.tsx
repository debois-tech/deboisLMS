import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import type { Toast, ToastVariant } from '@/lib/types';

interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, variant?: ToastVariant) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  showToast: () => {},
  removeToast: () => {},
});

/** Keep this in step with the `toastOut` animation in globals.css. */
const EXIT_MS = 180;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // A counter, not Date.now(): two toasts raised in the same millisecond used to
  // get the same id, which collides as a React key and drops one of them.
  const nextId = useRef(0);

  // Flagged first and dropped after the exit animation, so a dismissed toast
  // fades out instead of vanishing mid-frame.
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), EXIT_MS);
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'success') => {
      nextId.current += 1;
      const id = `toast-${nextId.current}`;
      setToasts((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => removeToast(id), 4000);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
