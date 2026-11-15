// Only the developer reads raw database and storage text; everyone else gets the plain line.
let verbose = false;
export const setVerboseErrors = (on: boolean) => { verbose = on; };

/** An error whose technical half (`detail`) is shown to the developer only. */
export const techError = (what: string, detail?: string | null) => new Error(verbose && detail ? `${what}: ${detail}` : what);

/** The message to show a user for a thrown value, narrowed from `unknown` in one place. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;

  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message) return message;
  }

  return fallback;
}
