import { useState } from 'react';
import type { StudentCredentials } from '@/lib/types';
import { derivePortalPassword } from '@/lib/utils/portalPassword';
import { errorMessage } from '@/lib/utils/errors';

interface UseLoginCredentialsOptions {
  phone?: string;
  /** True once the password was reset to a random one, which cannot be recomputed. */
  passwordRotated?: boolean;
  createLogin: (rotate: boolean) => Promise<StudentCredentials>;
  onCreated?: () => void;
}

/** Shared by StudentLoginCard and TutorLoginCard: derive-or-fetch the one-time password. */
export function useLoginCredentials({ phone, passwordRotated, createLogin, onCreated }: UseLoginCredentialsOptions) {
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
      const result = await createLogin(rotate);
      setFresh(result);
      onCreated?.();
    } catch (err) {
      setError(errorMessage(err, rotate ? 'Failed to reset the password' : 'Failed to create login'));
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, fresh, password, rotated, run };
}
