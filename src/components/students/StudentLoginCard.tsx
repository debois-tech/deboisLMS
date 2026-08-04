import { useState } from 'react';
import { Check, Copy, KeyRound, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { createStudentLogin } from '@/lib/supabase';
import type { StudentCredentials } from '@/lib/types';
import { derivePortalPassword } from '@/lib/utils/portalPassword';

interface StudentLoginCardProps {
  studentId: string;
  email?: string;
  phone?: string;
  hasLogin: boolean;
  onCreated?: () => void;
}

/**
 * The student's portal login: its current password, and the reset that rotates it.
 *
 * The password shown is recomputed from the phone number, not read back from
 * Supabase Auth — Auth stores a hash and nothing here stores a plaintext copy.
 * That works because `create-student-login` derives the password deterministically
 * and a reset re-applies the same rule, so what is displayed stays correct unless
 * the student changes it themselves in the portal.
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
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create login');
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
        <CredentialRow label="Password" value={password} />
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

      <div className="flex items-center gap-3">
        <Button className="action-button-compact" variant="secondary" onClick={run} loading={loading}>
          <RotateCcw size={15} />
          Reset password
        </Button>
        {password && (
          <p className="text-xs text-[var(--text-muted)]">
            Reset uses the same password rule.
          </p>
        )}
      </div>
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

export function CredentialRow({ label, value }: { label: string; value: string }) {
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
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label.toLowerCase()}`}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]"
      >
        {copied ? <Check size={16} className="text-[var(--success-text)]" /> : <Copy size={16} />}
      </button>
    </div>
  );
}
