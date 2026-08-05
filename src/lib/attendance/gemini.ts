import { supabase } from '@/lib/supabase/client';

/**
 * Client side of AI name matching.
 *
 * The Gemini key is NOT here. It used to be read from `VITE_GEMINI_API_KEY`,
 * which Vite inlines into the client bundle — readable by any student with
 * DevTools, and spendable against our quota by anyone who found it. The call now
 * runs in the `match-name` edge function, which holds the key as a Supabase
 * secret and checks the caller is an admin.
 *
 * The health cache below stays client-side on purpose: it is per-session UI
 * state, not a security control.
 */

/**
 * Lazy health cache. Once a request fails, subsequent calls short-circuit so a
 * broken key or an exhausted quota does not produce one failed request per
 * unmatched name. Cleared on page reload, so a fixed key is picked up at once.
 *
 * Auth / configuration errors (4xx, 501) permanently disable AI matching for the
 * session. Rate-limit and server errors (429/5xx) only start a cooldown and are
 * retried later, since quota can recover within the same session.
 */
let geminiUnavailableReason: string | null = null;
let geminiCooldownUntil = 0;

/** Why AI name matching is currently disabled, if it is. */
export function getGeminiUnavailableReason(): string | null {
  return geminiUnavailableReason;
}

/**
 * Whether AI matching is worth attempting.
 *
 * The browser can no longer see whether a key is configured — that is the point
 * — so this is optimistic until the first call proves otherwise. A missing key
 * comes back as 501 on the first attempt and disables matching from then on.
 */
export function isGeminiConfigured(): boolean {
  return geminiUnavailableReason === null;
}

export interface GeminiMatchResult {
  index: number;
  confidence: number;
}

/**
 * Ask Gemini to find the closest roster entry for a participant name.
 *
 * Deterministic matching always runs first; this is only a fallback for names
 * that could not be confidently matched locally. Any failure returns `null` so
 * the caller degrades to "flag for manual review".
 *
 * @param rawName  Participant name exactly as it appeared in the CSV.
 * @param candidates  Roster names to pick from, in order (indexes match).
 */
export async function matchNameWithGemini(
  rawName: string,
  candidates: string[],
): Promise<GeminiMatchResult | null> {
  if (candidates.length === 0) return null;
  if (geminiUnavailableReason) return null;
  if (Date.now() < geminiCooldownUntil) return null;

  const disableAndWarn = (reason: string) => {
    geminiUnavailableReason = reason;
    console.warn(`[attendance-parser] AI name matching disabled: ${reason}`);
  };

  const cooldownAndWarn = (reason: string, retryMs: number) => {
    geminiCooldownUntil = Date.now() + Math.max(retryMs, 30_000);
    console.warn(`[attendance-parser] ${reason} — retrying in ${Math.round(retryMs / 1000)}s`);
  };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      disableAndWarn('Signed out — sign in again to use AI name matching');
      return null;
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/match-name`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw_name: rawName, candidates }),
      },
    );

    if (!response.ok) {
      const status = response.status;
      const detail = await response
        .json()
        .then((b: { error?: string } | null) => b?.error)
        .catch(() => undefined);

      if (status === 429) {
        const retryAfter = Number(response.headers.get('retry-after'));
        const retryMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 60_000;
        cooldownAndWarn(detail ?? 'Gemini API rate limited (429)', retryMs);
      } else if (status >= 500 && status !== 501) {
        cooldownAndWarn(detail ?? `Gemini API server error (${status})`, 60_000);
      } else {
        // 4xx and 501: a missing key, a bad key, or a non-admin caller. None of
        // these recover on their own within a session.
        disableAndWarn(detail ?? `AI matching unavailable (${status})`);
      }
      return null;
    }

    const body = await response.json();
    if (body?.matched === true && Number.isInteger(body.index) && typeof body.confidence === 'number') {
      return { index: body.index, confidence: body.confidence };
    }

    // A clean "not in the roster" — not a failure, and not a reason to stop
    // asking about the next name.
    return null;
  } catch (error) {
    disableAndWarn(
      `AI matching request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}
