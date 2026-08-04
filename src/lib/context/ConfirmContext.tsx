import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';

export interface ConfirmOptions {
  title: string;
  /** What actually happens, and what cannot be undone. One or two lines. */
  message?: ReactNode;
  /** Names the action, never "OK" — the button should read as the thing it does. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button. Use for anything that destroys or detaches data. */
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  open: boolean;
}

interface ConfirmContextValue {
  state: ConfirmState;
  /** Resolves true if the user confirmed, false on cancel, Escape or backdrop click. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  resolve: (accepted: boolean) => void;
}

const noop = async () => false;

const ConfirmContext = createContext<ConfirmContextValue>({
  state: { open: false, title: '' },
  confirm: noop,
  resolve: () => {},
});

/**
 * One confirmation dialog for the whole app, so destructive actions stop
 * reaching for `window.confirm` — which renders an OS dialog that ignores the
 * theme, cannot be styled, and gives no room to say what is actually lost.
 *
 * Usage:
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: 'Delete this?', danger: true }))) return;
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState>({ open: false, title: '' });
  // Held across renders so the promise handed to the caller can be settled by
  // whichever button they press later.
  const pending = useRef<((accepted: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    // A second request while one is open would strand the first promise, so the
    // previous one is settled as a cancel rather than left hanging forever.
    pending.current?.(false);
    setState({ ...options, open: true });
    return new Promise<boolean>((resolvePromise) => {
      pending.current = resolvePromise;
    });
  }, []);

  const resolve = useCallback((accepted: boolean) => {
    pending.current?.(accepted);
    pending.current = null;
    setState((prev) => ({ ...prev, open: false }));
  }, []);

  return (
    <ConfirmContext.Provider value={{ state, confirm, resolve }}>
      {children}
    </ConfirmContext.Provider>
  );
}

/** Returns the `confirm(options)` function. See `ConfirmProvider` for the shape. */
export function useConfirm() {
  return useContext(ConfirmContext).confirm;
}

/** Internal — only `ConfirmDialog` needs this. */
export function useConfirmState() {
  const { state, resolve } = useContext(ConfirmContext);
  return { state, resolve };
}
