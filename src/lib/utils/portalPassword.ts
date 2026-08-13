/** Derived, not stored. MUST match generatePassword in supabase/functions/create-student-login. */
export function derivePortalPassword(phone?: string | null): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 4) return null;
  return `Debois@${digits.slice(-4)}`;
}
