import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../client';
import type { StudentCredentials } from '@/lib/types';

/** A failure throws, so an empty array only ever means "no rows" — never an RLS denial. */
interface Result<T> {
  data: T | null;
  error: PostgrestError | null;
}

/** Postgrest's "no rows returned" from `.single()` — absence, not failure. */
const NO_ROWS = 'PGRST116';

function fail(error: PostgrestError, what: string): never {
  // `details` carries the useful part for RLS and constraint violations.
  const detail = error.details ? ` (${error.details})` : '';
  throw new Error(`${what}: ${error.message}${detail}`);
}

/** A list query. Throws on failure; `[]` means the table really had no matches. */
export function rows<T>(result: Result<T[]>, what: string): T[] {
  if (result.error) fail(result.error, what);
  return result.data ?? [];
}

/** A `.single()` / `.maybeSingle()` lookup where "not found" is a normal answer. */
export function maybeRow<T>(result: Result<T>, what: string): T | undefined {
  if (result.error) {
    if (result.error.code === NO_ROWS) return undefined;
    fail(result.error, what);
  }
  return result.data ?? undefined;
}

/** An insert or update that must have produced a row. */
export function row<T>(result: Result<T>, what: string): T {
  if (result.error) fail(result.error, what);
  if (!result.data) throw new Error(`${what}: the database returned no row.`);
  return result.data;
}

/** A delete or other write with nothing to return. */
export function ok(result: { error: PostgrestError | null }, what: string): void {
  if (result.error) fail(result.error, what);
}

/** Shared by create-student-login and create-tutor-login: same request/response shape either side. */
export async function invokeLoginFunction(name: string, body: Record<string, unknown>): Promise<StudentCredentials> {
  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    // Non-2xx surfaces as a generic message; the useful reason is on error.context.
    let detail: string | undefined;
    const response = (error as { context?: Response }).context;
    if (response && typeof response.json === 'function') {
      detail = await response
        .json()
        .then((responseBody: { error?: string } | null) => responseBody?.error)
        .catch(() => undefined);
    }
    throw new Error(detail ?? error.message ?? 'Failed to create login');
  }
  if (data?.error) throw new Error(data.error);

  return data as StudentCredentials;
}
