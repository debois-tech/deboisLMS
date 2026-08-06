/**
 * Portal passwords are derived (`Debois@<last 4 phone digits>`), not stored, so
 * the dashboard can show the current one by recomputing it. MUST stay in step with
 * `generatePassword` in supabase/functions/create-student-login/index.ts. Returns
 * null when not derivable — fewer than four digits means a random suffix only a
 * reset can recover.
 */
export function derivePortalPassword(phone?: string | null): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 4) return null;
  return `Debois@${digits.slice(-4)}`;
}
