import { useState } from 'react';
import { Check, Copy, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { createStudentLogin } from '@/lib/supabase';
import type { StudentCredentials } from '@/lib/types';

interface StudentLoginCardProps {
  studentId: string;
  hasEmail: boolean;
  hasLogin: boolean;
  onCreated?: () => void;
}

/**
 * Create or reset a student's portal login. The password comes back from the edge function
 * once and is never stored — if the admin loses it, the only path is another reset.
 */
export function StudentLoginCard({ studentId, hasEmail, hasLogin, onCreated }: StudentLoginCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState<StudentCredentials | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await createStudentLogin(studentId);
      setCredentials(result);
      onCreated?.();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-start gap-3">
        {error && <InlineAlert>{error}</InlineAlert>}
        <Button className='action-button-compact' variant="secondary" onClick={handleClick} loading={loading} disabled={!hasEmail}>
          <KeyRound size={15} />
          {hasLogin ? 'Reset login' : 'Create login'}
        </Button>
        {!hasEmail && (
          <p className="text-xs text-[var(--text-muted)]">
            Add an email to this student before creating a login.
          </p>
        )}
      </div>

      <CredentialsModal credentials={credentials} onClose={() => setCredentials(null)} />
    </>
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
      footer={<Button className='action-button-compact' onClick={onClose}>Done</Button>}
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

function CredentialRow({ label, value }: { label: string; value: string }) {
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
        {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
      </button>
    </div>
  );
}
