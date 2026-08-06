import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  /** What actually failed. The thrown message, not a generic apology. */
  message: string;
  onRetry?: () => void;
  /** Fills the page when a whole page failed to load; inline inside a card otherwise. */
  centered?: boolean;
}

/** A load that failed, shown as a failure — never as an empty state, which would claim the data is gone. */
export function ErrorState({ message, onRetry, centered = false }: ErrorStateProps) {
  const body = (
    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
      <div className="w-14 h-14 rounded-[var(--radius-lg)] bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center mb-3 text-[var(--danger-text)]">
        <AlertTriangle size={26} />
      </div>
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Couldn't load this page</h3>
      <p className="text-xs text-[var(--text-muted)] max-w-sm mb-4 break-words">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} size="sm" variant="secondary">
          Try again
        </Button>
      )}
    </div>
  );

  if (!centered) return body;

  return <div className="flex min-h-[60vh] items-center justify-center">{body}</div>;
}
