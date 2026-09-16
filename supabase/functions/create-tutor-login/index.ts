
import { createClient } from 'jsr:@supabase/supabase-js@2';

/** Origins allowed to call this. Unset means '*' — set ALLOWED_ORIGINS at deploy. */
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
    const { tutor_id, rotate } = await req.json();
    if (!tutor_id) {
      return new Response(JSON.stringify({ error: 'tutor_id is required' }), {
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

    const { data: tutor, error: tutorError } = await adminClient
      .from('tutors')
      .select('id, email, phone, auth_user_id, password_rotated')
      .eq('id', tutor_id)
      .single();

    if (tutorError || !tutor) {
      return new Response(JSON.stringify({ error: 'Tutor not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!tutor.email) {
      return new Response(JSON.stringify({ error: 'Tutor has no email on file' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rotating = Boolean(rotate) && Boolean(tutor.auth_user_id);
    const password = rotating ? rotatedPassword() : generatePassword(tutor.phone);

    if (tutor.auth_user_id) {
      const { error } = await adminClient.auth.admin.updateUserById(tutor.auth_user_id, { password });
      if (error) throw error;

      if (Boolean(tutor.password_rotated) !== rotating) {
        await adminClient
          .from('tutors')
          .update({ password_rotated: rotating })
          .eq('id', tutor.id);
      }
    } else {
      const { data: created, error } = await adminClient.auth.admin.createUser({
        email: tutor.email,
        password,
        email_confirm: true,
        app_metadata: { role: 'tutor', tutor_id: tutor.id },
      });
      if (error) throw error;

      await adminClient
        .from('tutors')
        .update({ auth_user_id: created.user.id, password_rotated: false })
        .eq('id', tutor.id);
    }

    return new Response(JSON.stringify({ email: tutor.email, password, rotated: rotating }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // Logged in full, returned as a generic line: the raw text names internal
    // tables and auth internals the caller has no business seeing.
    console.error('[create-tutor-login]', err);
    return new Response(JSON.stringify({ error: 'Could not create the login. Try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
