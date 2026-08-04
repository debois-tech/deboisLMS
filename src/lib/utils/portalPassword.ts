/**
 * Portal passwords are derived, not stored.
 *
 * `create-student-login` builds the password as `Debois@<last 4 phone digits>`
 * and returns it once — Supabase Auth keeps only a hash, so there is no API that
 * gives it back. Because the rule is deterministic, the admin dashboard can show
 * the current password by recomputing it from the phone number instead of the
 * app keeping a plaintext copy of every student's credentials.
 *
 * MUST stay in step with `generatePassword` in
 * supabase/functions/create-student-login/index.ts. If that rule changes, this
 * function starts lying, which is worse than showing nothing.
 *
 * Returns null when the password is not derivable: with fewer than four digits
 * on file the edge function falls back to a random suffix, and the only way back
 * to a known password is a reset.
 */
export function derivePortalPassword(phone?: string | null): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 4) return null;
  return `Debois@${digits.slice(-4)}`;
}
