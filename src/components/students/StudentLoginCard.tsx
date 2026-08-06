import { ReactNode, useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { createStudentLogin } from '@/lib/supabase';
import type { StudentCredentials } from '@/lib/types';
import { derivePortalPassword } from '@/lib/utils/portalPassword';
import { errorMessage } from '@/lib/utils/errors';

interface StudentLoginCardProps {
  studentId: string;
  email?: string;
  phone?: string;
  hasLogin: boolean;
  onCreated?: () => void;
}

/**
 * The student's portal login: current password (recomputed from the phone, since
 * Auth stores only a hash) and the reset that rotates it.
 */
export function StudentLoginCard({ studentId, email, phone, hasLogin, onCreated }: StudentLoginCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fresh, setFresh] = useState<StudentCredentials | null>(null);

  const derived = derivePortalPassword(phone);
  // A just-returned password is authoritative; otherwise fall back to the rule.
  const password = fresh?.password ?? derived;

  const run = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await createStudentLogin(studentId);
      setFresh(result);
      onCreated?.();
    } catch (err) {
      setError(errorMessage(err, 'Failed to create login'));
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
        <Button className="action-button-compact" variant="secondary" onClick={run} loading={loading}>
          <KeyRound size={15} />
          Create login
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <InlineAlert>{error}</InlineAlert>}

      <CredentialRow label="Email" value={email} />

      {password ? (
        <CredentialRow
          label="Password"
          value={password}
          action={(
            <button type="button" onClick={run} disabled={loading} className="credential-reset">
              Reset
            </button>
          )}
        />
      ) : (
        <div className="credential-row">
          <div className="min-w-0">
            <p className="credential-label">Password</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Random password. Reset to generate a new one.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}

export function CredentialsModal({
  credentials,
  onClose,
}: {
  credentials: StudentCredentials | null;
  onClose: () => void;
}) {
  return (
    <Modal
      open={credentials !== null}
      onClose={onClose}
      title="Portal login ready"
      footer={<Button className="action-button-compact" onClick={onClose}>Done</Button>}
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
