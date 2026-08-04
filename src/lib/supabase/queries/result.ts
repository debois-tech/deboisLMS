import type { PostgrestError } from '@supabase/supabase-js';

/**
 * How every query in this layer handles a Postgrest response.
 *
 * The rule: a failure throws, so an empty array can only ever mean "no rows".
 * Returning `data ?? []` on error — which most of these queries used to do —
 * renders an RLS denial or a dropped connection as a confident empty state, and
 * the user is told they have no batches when the batches are sitting in the
 * database.
 *
 * Callers already run inside try/catch with a toast, or inside a page that can
 * show an error, so throwing is the useful behaviour.
 */

interface Result<T> {
  data: T | null;
  error: PostgrestError | null;
}

/** Postgrest's "no rows returned" from `.single()` — absence, not failure. */
const NO_ROWS = 'PGRST116';

function fail(error: PostgrestError, what: string): never {
  // `details` carries the useful part for RLS and constraint violations, which
  // is exactly where the bare `message` is least informative.
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
