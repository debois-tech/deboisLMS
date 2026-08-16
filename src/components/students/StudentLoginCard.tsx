import { ReactNode, useState } from 'react';
import { Check, Copy, KeyRound, Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { createStudentLogin, sendCredentialsEmail } from '@/lib/supabase';
import type { StudentCredentials } from '@/lib/types';
import { derivePortalPassword } from '@/lib/utils/portalPassword';
import { errorMessage } from '@/lib/utils/errors';

interface EmailCredentialsButtonProps {
  studentId: string;
  password: string;
  size?: 'sm' | 'md';
}

/**
 * Mails one student the login on screen. Locks once it has succeeded: a second
 * press would send a second copy of the same password with nothing on screen
 * admitting it happened twice. The import dialog runs its own, per row.
 */
export function EmailCredentialsButton({ studentId, password, size = 'md' }: EmailCredentialsButtonProps) {
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    setSending(true);
    setError('');
    try {
      const result = await sendCredentialsEmail([{ studentId, password }]);
      // The function answers per recipient, so one that came back in `failed`
      // must not light up as sent.
      if (result.sent.includes(studentId)) setDone(true);
      else setError(result.failed[0]?.reason ?? 'Could not send the email');
    } catch (err) {
      setError(errorMessage(err, 'Could not send the email'));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {error && <InlineAlert>{error}</InlineAlert>}
      <Button
        className="action-button-compact"
        variant="secondary"
        size={size}
        onClick={send}
        loading={sending}
        disabled={done}
      >
        {done ? <Check size={15} /> : <Mail size={15} />}
        {done ? 'Emailed' : 'Email'}
      </Button>
    </>
  );
}

interface StudentLoginCardProps {
  studentId: string;
  email?: string;
  phone?: string;
  hasLogin: boolean;
  /** True once the password was reset to a random one, which cannot be recomputed. */
  passwordRotated?: boolean;
  onCreated?: () => void;
}

/** Create uses the derived password; reset issues a random one, shown once. */
export function StudentLoginCard({
  studentId, email, phone, hasLogin, passwordRotated, onCreated,
}: StudentLoginCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fresh, setFresh] = useState<StudentCredentials | null>(null);

  const derived = derivePortalPassword(phone);
  // Derived password only holds until a reset; after that there is nothing to recompute.
  const rotated = fresh?.rotated ?? passwordRotated ?? false;
  const password = fresh?.password ?? (rotated ? null : derived);

  const run = async (rotate = false) => {
    setLoading(true);
    setError('');
    try {
      const result = await createStudentLogin(studentId, rotate);
      setFresh(result);
      onCreated?.();
    } catch (err) {
      setError(errorMessage(err, rotate ? 'Failed to reset the password' : 'Failed to create login'));
    } finally {
      setLoading(false);
    }
  };

  if (!email) {
    return (
      <p className="text-xs text-[var(--text-muted)]">
        Add an email to create a login.
      </p>
    );
  }

  if (!hasLogin && !fresh) {
    return (
      <div className="flex flex-col items-start gap-3">
        {error && <InlineAlert>{error}</InlineAlert>}
        <Button className="action-button-compact" variant="secondary" onClick={() => run()} loading={loading}>
          <KeyRound size={15} />
          Create login
        </Button>
      </div>
    );
  }

  const resetButton = (
    <button type="button" onClick={() => run(true)} disabled={loading} className="credential-reset">
      {loading ? 'Resetting…' : 'Reset'}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      {error && <InlineAlert>{error}</InlineAlert>}

      <CredentialRow label="Email" value={email} />

      {password ? (
        <CredentialRow label="Password" value={password} action={resetButton} />
      ) : (
        <div className="credential-row">
          <div className="min-w-0">
            <p className="credential-label">Password</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Reset to a random password, shown once. Reset again to issue a new one.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">{resetButton}</div>
        </div>
      )}

      {fresh?.rotated && (
        <p className="text-xs text-[var(--text-muted)]">
          New password — copy it now. It is not stored and cannot be shown again.
        </p>
      )}

      {/* Keyed on the password so a reset re-arms the button rather than leaving
          it stuck on "Emailed" beside a password that was never sent. */}
      {password && (
        <div className="flex justify-start">
          <EmailCredentialsButton key={password} size="sm" studentId={studentId} password={password} />
        </div>
      )}
    </div>
  );
}

export function CredentialsModal({
  credentials,
  studentId,
  onClose,
}: {
  credentials: StudentCredentials | null;
  studentId: string | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={credentials !== null}
      onClose={onClose}
      title="Portal login ready"
      footer={
        <>
          {credentials && studentId && (
            <EmailCredentialsButton studentId={studentId} password={credentials.password} />
          )}
          <Button className="action-button-compact" onClick={onClose}>Done</Button>
        </>
      }
    >
      {credentials && (
        <div className="flex flex-col gap-3">
          <CredentialRow label="Email" value={credentials.email} />
          <CredentialRow label="Password" value={credentials.password} />
        </div>
      )}
    </Modal>
  );
}

export function CredentialRow({ label, value, action }: { label: string; value: string; action?: ReactNode }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="credential-row">
      <div className="min-w-0">
        <p className="credential-label">{label}</p>
        <p className="credential-value">{value}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {action}
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label.toLowerCase()}`}
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]"
        >
          {copied ? <Check size={15} className="text-[var(--success-text)]" /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
}
