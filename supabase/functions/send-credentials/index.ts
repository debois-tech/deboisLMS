import { createClient } from 'jsr:@supabase/supabase-js@2';
import { credentialsEmail } from './template.ts';

/**
 * Mails portal credentials to the students they belong to.
 *
 * The caller supplies the password because this runs on a button the admin
 * presses *after* reviewing the credentials on screen — by then the plaintext
 * only exists in their browser, and `create-student-login` deliberately never
 * stored it. What the caller may NOT supply is where the mail goes: the address
 * and the name are read from the students row every time, so a tampered or
 * simply buggy client cannot redirect a credential to an inbox of its choosing.
 */

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  // Comma or whitespace: a space-separated value used to fall through as one
  // long 'origin', which the browser then rejected as multiple values in the header.
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

/** Resend takes 100 messages per batch call. One import is one or two requests. */
const BATCH_SIZE = 100;

/** Belt and braces against a runaway caller; a CSV import is nowhere near this. */
const MAX_RECIPIENTS = 500;

interface Recipient {
  student_id: string;
  password: string;
}

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('CREDENTIALS_FROM_EMAIL');
    // The student sign-in page, not /portal: an unauthenticated visitor to
    // /portal is bounced to the login *choice* screen and asked whether they are
    // an admin, which is not a question to put to a student.
    const portalUrl = Deno.env.get('PORTAL_URL');
    // Optional. The From address never has to be a real mailbox, so replies are
    // pointed at one that is — otherwise "reply to this email" is a dead end.
    const replyTo = Deno.env.get('CREDENTIALS_REPLY_TO');

    // Named individually: "not configured" costs an afternoon, "PORTAL_URL is
    // not set" costs a minute.
    const missing = [
      !apiKey && 'RESEND_API_KEY',
      !from && 'CREDENTIALS_FROM_EMAIL',
      !portalUrl && 'PORTAL_URL',
    ].filter(Boolean);
    if (missing.length > 0) {
      console.error('[send-credentials] missing secrets:', missing.join(', '));
      return json({ error: `Email is not configured yet (${missing.join(', ')}).` }, 500);
    }

    const body = await req.json().catch(() => null);
    const recipients: Recipient[] = Array.isArray(body?.recipients) ? body.recipients : [];

    if (recipients.length === 0) {
      return json({ error: 'No recipients given' }, 400);
    }
    if (recipients.length > MAX_RECIPIENTS) {
      return json({ error: `Too many recipients — ${MAX_RECIPIENTS} at a time.` }, 400);
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

    const ids = [...new Set(recipients.map((entry) => entry.student_id).filter(Boolean))];
    const { data: students, error: studentsError } = await adminClient
      .from('students')
      .select('id, name, email')
      .in('id', ids);

    if (studentsError) throw studentsError;

    // The batch names the course in the email. Read here rather than taken from
    // the caller: the same rule as the address — the client says who to mail, the
    // database says what is true about them. A failure here is not fatal; the
    // template drops the course clause and the credentials still go out.
    const { data: enrolments } = await adminClient
      .from('batch_student_mapping')
      .select('student_id, joined_at, batches(name)')
      .in('student_id', ids)
      .eq('status', 'active')
      .order('joined_at', { ascending: false });

    // Most recently joined wins, matching how the app picks a "current" batch.
    const courseByStudent = new Map<string, string>();
    for (const row of (enrolments ?? []) as { student_id: string; batches?: { name?: string } | null }[]) {
      if (!courseByStudent.has(row.student_id) && row.batches?.name) {
        courseByStudent.set(row.student_id, row.batches.name);
      }
    }

    const byId = new Map((students ?? []).map((student) => [student.id, student]));
    const failed: { studentId: string; reason: string }[] = [];
    const queued: { studentId: string; payload: Record<string, unknown> }[] = [];

    for (const entry of recipients) {
      const student = byId.get(entry.student_id);
      if (!student) {
        failed.push({ studentId: entry.student_id, reason: 'Student not found' });
        continue;
      }
      if (!student.email) {
        failed.push({ studentId: entry.student_id, reason: 'No email on file' });
        continue;
      }
      if (!entry.password) {
        failed.push({ studentId: entry.student_id, reason: 'No password to send' });
        continue;
      }

      const { subject, html, text } = credentialsEmail({
        name: student.name ?? '',
        email: student.email,
        password: entry.password,
        portalUrl: portalUrl!,
        courseName: courseByStudent.get(student.id),
      });

      queued.push({
        studentId: student.id,
        // `to` is the database's address, never the caller's.
        payload: {
          from,
          to: [student.email],
          ...(replyTo ? { reply_to: replyTo } : {}),
          subject,
          html,
          text,
        },
      });
    }

    const sent: string[] = [];

    for (let index = 0; index < queued.length; index += BATCH_SIZE) {
      const chunk = queued.slice(index, index + BATCH_SIZE);

      const response = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk.map((item) => item.payload)),
      });

      if (!response.ok) {
        // One rejected chunk is not a rejected run — the rest still go out, and
        // the caller is told exactly who missed out.
        const detail = await response.text().catch(() => '');
        console.error('[send-credentials] resend batch failed', response.status, detail);
        const reason = response.status === 429
          ? 'Email service is rate limiting — try these again shortly'
          : 'Email service refused the message';
        chunk.forEach((item) => failed.push({ studentId: item.studentId, reason }));
        continue;
      }

      chunk.forEach((item) => sent.push(item.studentId));
    }

    return json({ sent, failed });
  } catch (err) {
    console.error('[send-credentials]', err);
    return json({ error: 'Could not send the emails. Try again.' }, 500);
  }
});
