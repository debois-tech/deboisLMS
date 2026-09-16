import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { CredentialRow } from '@/components/students/StudentLoginCard';
import { createTutorLogin } from '@/lib/supabase';
import type { StudentCredentials } from '@/lib/types';
import { useLoginCredentials } from '@/lib/hooks/useLoginCredentials';

interface TutorLoginCardProps {
  tutorId: string;
  email?: string;
  phone?: string;
  hasLogin: boolean;
  /** True once the password was reset to a random one, which cannot be recomputed. */
  passwordRotated?: boolean;
  onCreated?: () => void;
}

/** Mirrors StudentLoginCard, minus the email-send step — tutors get their password handed to them directly. */
export function TutorLoginCard({ tutorId, email, phone, hasLogin, passwordRotated, onCreated }: TutorLoginCardProps) {
  const { loading, error, fresh, password, rotated, run } = useLoginCredentials({
    phone,
    passwordRotated,
    createLogin: (rotate) => createTutorLogin(tutorId, rotate),
    onCreated,
  });

  if (!email) {
    return <p className="text-xs text-[var(--text-muted)]">Add an email to create a login.</p>;
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

      {rotated && fresh && (
        <p className="text-xs text-[var(--text-muted)]">
          New password — copy it now. It is not stored and cannot be shown again.
        </p>
      )}
    </div>
  );
}

export function TutorCredentialsModal({
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
      title="Tutor login ready"
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
