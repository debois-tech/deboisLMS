/** Gemini model used for fuzzy name matching (override with VITE_GEMINI_MODEL). */
const GEMINI_MODEL = (import.meta.env.VITE_GEMINI_MODEL as string | undefined) ?? 'gemini-2.0-flash';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Gemini API key for browser use. Vite only exposes `VITE_`-prefixed
 * environment variables to the client.
 */
export function getGeminiApiKey(): string | undefined {
  return import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
}

/** True when a plausible Gemini key is configured (AIza… keys are ~39 chars). */
export function isGeminiConfigured(): boolean {
  const key = getGeminiApiKey();
  return Boolean(key && key.length >= 20);
}

/**
 * Lazy health cache. Once a request fails, subsequent calls short-circuit so
 * a broken/missing key does not spam the network with 400/403 errors for every
 * unmatched name. Cleared on page reload, so a fixed key is picked up at once.
 *
 * Auth errors (400/401/403) permanently disable AI matching for the session.
 * Rate-limit / server errors (429/5xx) only start a cooldown and are retried
 * later, since the quota can recover within the same session.
 */
let geminiUnavailableReason: string | null = null;
let geminiCooldownUntil = 0;

/** Why AI name matching is currently disabled, if it is. */
export function getGeminiUnavailableReason(): string | null {
  return geminiUnavailableReason;
}

export interface GeminiMatchResult {
  index: number;
  confidence: number;
}

/**
 * Ask Gemini to find the closest roster entry for a participant name.
 *
 * Deterministic matching always runs first; this is only a fallback for names
 * that could not be confidently matched locally. Any failure (missing/invalid
 * key, network error, non-OK response, malformed output) returns `null` so the
 * caller can degrade gracefully to "flag for manual review".
 *
 * @param rawName  Participant name exactly as it appeared in the CSV.
 * @param candidates  Roster names to pick from, in order (indexes match).
 * @returns the chosen candidate index + confidence, or `null`.
 */
export async function matchNameWithGemini(
  rawName: string,
  candidates: string[],
): Promise<GeminiMatchResult | null> {
  const apiKey = getGeminiApiKey();
  if (!apiKey || candidates.length === 0) return null;

  if (geminiUnavailableReason) return null;
  if (Date.now() < geminiCooldownUntil) return null;

  const prompt = [
    'You are a name-matching assistant for a Google Meet attendance export.',
    `Participant name from the CSV: "${rawName}"`,
    'Official roster (index: name):',
    ...candidates.map((name, i) => `${i}: ${name}`),
    'Find the closest roster entry based ONLY on name similarity (case, spacing, minor typos, name order).',
    'If the participant is clearly not in the roster, matched must be false.',
    'Respond with JSON only: {"matched": boolean, "index": number, "confidence": number between 0 and 1, "reason": "short reason"}',
  ].join('\n');

  const disableAndWarn = (reason: string) => {
    geminiUnavailableReason = reason;
    console.warn(`[attendance-parser] AI name matching disabled: ${reason}`);
  };

  const cooldownAndWarn = (reason: string, retryMs: number) => {
    geminiCooldownUntil = Date.now() + Math.max(retryMs, 30_000);
    console.warn(`[attendance-parser] ${reason} — retrying in ${Math.round(retryMs / 1000)}s`);
  };

  try {
    const response = await fetch(
      `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json' },
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const status = response.status;

      if (status === 429) {
        // Rate limit / no quota. Transient: cooldown and retry later rather than
        // disabling AI matching for the whole session.
        const retryAfter = Number(response.headers.get('retry-after'));
        const retryMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 60_000;
        cooldownAndWarn(
          `Gemini API rate limited (429)${detail ? ` — ${detail.slice(0, 160)}` : ''}`,
          retryMs,
        );
      } else if (status >= 500) {
        cooldownAndWarn(`Gemini API server error (${status})`, 60_000);
      } else {
        // Auth / malformed request (400/401/403/404…) — a bad key will not recover.
        disableAndWarn(
          `Gemini API error ${status}${detail ? ` — ${detail.slice(0, 200)}` : ''}`,
        );
      }
      return null;
    }

    const data = await response.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      disableAndWarn('Gemini returned an empty response');
      return null;
    }

    const parsed = JSON.parse(text.replace(/^```json\s*/i, '').replace(/```$/, '').trim());

    if (
      parsed &&
      parsed.matched === true &&
      Number.isInteger(parsed.index) &&
      parsed.index >= 0 &&
      parsed.index < candidates.length &&
      typeof parsed.confidence === 'number' &&
      parsed.confidence >= 0 &&
      parsed.confidence <= 1
    ) {
      return { index: parsed.index, confidence: parsed.confidence };
    }

    disableAndWarn('Gemini returned a malformed match response');
    return null;
  } catch (error) {
    disableAndWarn(
      `Gemini request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}
