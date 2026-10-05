import { createClient } from 'jsr:@supabase/supabase-js@2';
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';

/**
 * Mails a certificate or offer letter that an admin already generated and stored (see
 * generateAndStoreDocument in queries/documents.ts). The client sends only ids — this
 * function reads the stored path and the release flag itself, so a client showing a stale
 * "Shared" state cannot mail a document that was never actually released.
 */

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(/[\s,]+/)
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const LABELS: Record<string, string> = { offer_letter: 'Offer Letter', cert: 'Certificate' };

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('CREDENTIALS_FROM_EMAIL');
    const replyTo = Deno.env.get('CREDENTIALS_REPLY_TO');

    const missing = [!apiKey && 'RESEND_API_KEY', !from && 'CREDENTIALS_FROM_EMAIL'].filter(Boolean);
    if (missing.length > 0) {
      console.error('[send-document] missing secrets:', missing.join(', '));
      return json({ error: `Email is not configured yet (${missing.join(', ')}).` }, 500);
    }

    const body = await req.json().catch(() => null);
    const { student_id, batch_id, doc_type } = body ?? {};
    if (!student_id || !batch_id || !LABELS[doc_type]) {
      return json({ error: 'Missing or invalid fields' }, 400);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller || caller.app_metadata?.role !== 'admin') {
      return json({ error: 'Admin only' }, 403);
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SECRET_SERVICE_ROLE_KEY')!,
    );

    const pathColumn = doc_type === 'offer_letter' ? 'offer_letter_path' : 'cert_path';
    const sharedColumn = doc_type === 'offer_letter' ? 'offer_letter_shared' : 'cert_shared';

    const { data: mapping, error: mappingError } = await adminClient
      .from('batch_student_mapping')
      .select(`${pathColumn}, ${sharedColumn}`)
      .eq('student_id', student_id)
      .eq('batch_id', batch_id)
      .maybeSingle<Record<string, string | boolean | null>>();
    if (mappingError) throw mappingError;

    if (!mapping?.[sharedColumn]) {
      return json({ error: 'This document has not been released to the student yet.' }, 403);
    }
    const path = mapping[pathColumn] as string | null;
    if (!path) return json({ error: 'This document has not been generated yet.' }, 404);

    const { data: student, error: studentError } = await adminClient
      .from('students')
      .select('name, email')
      .eq('id', student_id)
      .single();
    if (studentError || !student) return json({ error: 'Student not found' }, 404);
    if (!student.email) return json({ error: 'No email on file for this student' }, 400);

    const { data: file, error: downloadError } = await adminClient.storage.from('documents').download(path);
    if (downloadError || !file) return json({ error: 'The document is missing from storage.' }, 404);
    const pdfBase64 = encodeBase64(await file.arrayBuffer());

    const label = LABELS[doc_type];
    const name = escapeHtml(student.name ?? '');
    const subject = `Your ${label} from Deboistech`;
    const html = `<p>Hi ${name},</p><p>Please find your ${label.toLowerCase()} attached.</p>`;
    const text = `Hi ${name},\n\nPlease find your ${label.toLowerCase()} attached.`;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [student.email],
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject,
        html,
        text,
        attachments: [{ filename: `${label.replace(/\s+/g, '-')}.pdf`, content: pdfBase64 }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('[send-document] resend failed', response.status, detail);
      const reason = response.status === 429
        ? 'Email service is rate limiting — try again shortly'
        : 'Email service refused the message';
      return json({ error: reason }, response.status === 429 ? 429 : 502);
    }

    return json({ sent: true });
  } catch (err) {
    console.error('[send-document]', err);
    return json({ error: 'Could not send the email. Try again.' }, 500);
  }
});
