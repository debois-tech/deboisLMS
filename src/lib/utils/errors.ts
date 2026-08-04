/**
 * The message to show a user for a thrown value.
 *
 * Catch clauses used to be typed `any` so `err?.message` would compile. `any`
 * turns off type checking for everything downstream of it, and a caught value is
 * genuinely unknown — a rejected fetch, a Postgrest error object, a string, or
 * something with no message at all. This narrows it in one place instead.
 */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }

  return fallback;
}
