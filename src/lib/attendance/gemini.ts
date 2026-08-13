import { supabase } from '@/lib/supabase/client';

/** Client side of AI name matching. The Gemini key lives in the `match-name` edge function, not here. */
let geminiUnavailableReason: string | null = null;
let geminiCooldownUntil = 0;

/** Why AI name matching is currently disabled, if it is. */
export function getGeminiUnavailableReason(): string | null {
  return geminiUnavailableReason;
}

/** Optimistic until the first call proves otherwise. */
export function isGeminiConfigured(): boolean {
  return geminiUnavailableReason === null;
}

export interface GeminiMatchResult {
  index: number;
  confidence: number;
}

/** Any failure returns null, so the caller degrades to manual review. */
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
        // 4xx and 501: a missing key, a bad key, or a non-admin caller.
        disableAndWarn(detail ?? `AI matching unavailable (${status})`);
      }
      return null;
    }

    const body = await response.json();
    if (body?.matched === true && Number.isInteger(body.index) && typeof body.confidence === 'number') {
      return { index: body.index, confidence: body.confidence };
    }

    // A clean "not in the roster" — not a failure, so keep asking about the next name.
    return null;
  } catch (error) {
    disableAndWarn(
      `AI matching request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}
