// Edge Function: match-name
// Fuzzy-matches one Google Meet participant name against a batch roster using
// Gemini. Exists so the Gemini API key stays server-side: a VITE_-prefixed key is
// inlined into the client bundle and readable by every student who opens
// DevTools, and unlike the Supabase anon key it carries no authorization model —
// anyone holding it can spend the quota, billed to us.
//
// Set the secret (note: no VITE_ prefix, this never reaches the browser):
//   supabase secrets set GEMINI_API_KEY=... --project-ref <ref>
// Deploy:
//   supabase functions deploy match-name

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.0-flash';
const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { raw_name, candidates } = await req.json();

    if (typeof raw_name !== 'string' || !Array.isArray(candidates) || candidates.length === 0) {
      return json({ error: 'raw_name and a non-empty candidates array are required' }, 400);
    }

    // Attendance processing is an admin task. Verified from the caller's own JWT
    // so a student cannot use this as a free Gemini proxy on our quota.
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller || caller.app_metadata?.role !== 'admin') {
      return json({ error: 'Admin only' }, 403);
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    // 501, not 500: "not configured" is a deployment state the client should stop
    // retrying on, not a transient failure.
    if (!apiKey) return json({ error: 'GEMINI_API_KEY is not set', configured: false }, 501);

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
      const detail = await response.text().catch(() => '');
      // The upstream status is passed straight through: the client distinguishes
      // "bad key, stop trying" (4xx) from "rate limited, retry later" (429/5xx),
      // and that distinction is lost if everything becomes a 500.
      const retryAfter = response.headers.get('retry-after');
      return json(
        { error: `Gemini API error ${response.status}${detail ? ` — ${detail.slice(0, 200)}` : ''}` },
        response.status,
        retryAfter ? { 'retry-after': retryAfter } : {},
      );
    }

    const data = await response.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return json({ error: 'Gemini returned an empty response' }, 502);

    let parsed: any;
    try {
      parsed = JSON.parse(text.replace(/^```json\s*/i, '').replace(/```$/, '').trim());
    } catch {
      return json({ error: 'Gemini returned a malformed match response' }, 502);
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
      return json({ matched: true, index: parsed.index, confidence: parsed.confidence });
    }

    // A confident "not in the roster" is a valid answer, not a failure — the
    // caller flags the name for manual review.
    return json({ matched: false });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
