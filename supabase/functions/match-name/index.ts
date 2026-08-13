
import { createClient } from 'jsr:@supabase/supabase-js@2';

/** Origins allowed to call this. Unset means '*' — set ALLOWED_ORIGINS at deploy. */
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allow = ALLOWED_ORIGINS.length === 0
    ? '*'
    : ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    ...(ALLOWED_ORIGINS.length === 0 ? {} : { Vary: 'Origin' }),
  };
}

const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.0-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

const json = (req: Request, body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req), 'Content-Type': 'application/json', ...extraHeaders },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsFor(req) });
  }

  try {
    const { raw_name, candidates } = await req.json();

    if (typeof raw_name !== 'string' || !Array.isArray(candidates) || candidates.length === 0) {
      return json(req, { error: 'raw_name and a non-empty candidates array are required' }, 400);
    }

    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller || caller.app_metadata?.role !== 'admin') {
      return json(req, { error: 'Admin only' }, 403);
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    // 501, not 500: "not configured" is something the client should stop retrying on.
    if (!apiKey) return json(req, { error: 'GEMINI_API_KEY is not set', configured: false }, 501);

    const prompt = [
      'You are a name-matching assistant for a Google Meet attendance export.',
      `Participant name from the CSV: "${raw_name}"`,
      'Official roster (index: name):',
      ...candidates.map((name: string, i: number) => `${i}: ${name}`),
      'Find the closest roster entry based ONLY on name similarity (case, spacing, minor typos, name order).',
      'If the participant is clearly not in the roster, matched must be false.',
      'Respond with JSON only: {"matched": boolean, "index": number, "confidence": number between 0 and 1, "reason": "short reason"}',
    ].join('\n');

    const response = await fetch(`${BASE_URL}/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' },
      }),
    });

    if (!response.ok) {
      // Google's body can carry key and quota detail; it belongs in the log only.
      const detail = await response.text().catch(() => '');
      console.error('[match-name] Gemini error', response.status, detail.slice(0, 500));
      const retryAfter = response.headers.get('retry-after');
      return json(
        req,
        { error: `AI name matching is unavailable (${response.status}).` },
        response.status,
        retryAfter ? { 'retry-after': retryAfter } : {},
      );
    }

    const data = await response.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return json(req, { error: 'Gemini returned an empty response' }, 502);

    let parsed: any;
    try {
      parsed = JSON.parse(text.replace(/^```json\s*/i, '').replace(/```$/, '').trim());
    } catch {
      return json(req, { error: 'Gemini returned a malformed match response' }, 502);
    }

    if (
      parsed?.matched === true &&
      Number.isInteger(parsed.index) &&
      parsed.index >= 0 &&
      parsed.index < candidates.length &&
      typeof parsed.confidence === 'number' &&
      parsed.confidence >= 0 &&
      parsed.confidence <= 1
    ) {
      return json(req, { matched: true, index: parsed.index, confidence: parsed.confidence });
    }

    return json(req, { matched: false });
  } catch (err) {
    console.error('[match-name]', err);
    return json(req, { error: 'AI name matching failed. Match this name by hand.' }, 500);
  }
});
