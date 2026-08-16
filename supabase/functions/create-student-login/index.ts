
import { createClient } from 'jsr:@supabase/supabase-js@2';

/** Origins allowed to call this. Unset means '*' — set ALLOWED_ORIGINS at deploy. */
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

/** Debois@<last 4 phone digits>, so the dashboard can recompute it without storing it. */
function generatePassword(phone: string | null): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  const suffix = digits.length >= 4 ? digits.slice(-4) : Math.floor(100000 + Math.random() * 900000).toString();
  return `Debois@${suffix}`;
}

// No 0/O or 1/l/I: these get read aloud or retyped.
const SAFE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** Reset issues this instead of re-deriving, which returned the same string and changed nothing. */
function rotatedPassword(length = 10): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return `Debois@${Array.from(bytes, (byte) => SAFE_ALPHABET[byte % SAFE_ALPHABET.length]).join('')}`;
}

Deno.serve(async (req) => {
  const corsHeaders = corsFor(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { student_id, rotate } = await req.json();
    if (!student_id) {
      return new Response(JSON.stringify({ error: 'student_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller || caller.app_metadata?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SECRET_SERVICE_ROLE_KEY')!
    );

    const { data: student, error: studentError } = await adminClient
      .from('students')
      .select('id, email, phone, auth_user_id, password_rotated')
      .eq('id', student_id)
      .single();

    if (studentError || !student) {
      return new Response(JSON.stringify({ error: 'Student not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!student.email) {
      return new Response(JSON.stringify({ error: 'Student has no email on file' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rotating = Boolean(rotate) && Boolean(student.auth_user_id);
    const password = rotating ? rotatedPassword() : generatePassword(student.phone);

    if (student.auth_user_id) {
      const { error } = await adminClient.auth.admin.updateUserById(student.auth_user_id, { password });
      if (error) throw error;

      if (Boolean(student.password_rotated) !== rotating) {
        await adminClient
          .from('students')
          .update({ password_rotated: rotating })
          .eq('id', student.id);
      }
    } else {
      const { data: created, error } = await adminClient.auth.admin.createUser({
        email: student.email,
        password,
        email_confirm: true,
        app_metadata: { role: 'student', student_id: student.id },
      });
      if (error) throw error;

      await adminClient
        .from('students')
        .update({ auth_user_id: created.user.id, password_rotated: false })
        .eq('id', student.id);
    }

    return new Response(JSON.stringify({ email: student.email, password, rotated: rotating }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // Logged in full, returned as a generic line: the raw text names internal
    // tables and auth internals the caller has no business seeing.
    console.error('[create-student-login]', err);
    return new Response(JSON.stringify({ error: 'Could not create the login. Try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
