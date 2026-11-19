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

// The developer lists and creates admin accounts. Nobody else can: admins do not create each other.
Deno.serve(async (req) => {
  const corsHeaders = { ...corsFor(req), 'Content-Type': 'application/json' };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: corsHeaders });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
    );
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller || caller.app_metadata?.role !== 'developer') return json({ error: 'Developer only' }, 403);

    const adminClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SECRET_SERVICE_ROLE_KEY')!);
    const { action, email, password, full_name } = await req.json().catch(() => ({}));

    if (action === 'list') {
      // ponytail: first 1000 users only; page it if the account list ever outgrows that
      const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;
      const admins = data.users
        .filter((user) => user.app_metadata?.role === 'admin')
        .map((user) => ({
          id: user.id,
          email: user.email ?? '',
          name: (user.user_metadata?.full_name as string | undefined) ?? '',
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at ?? null,
        }));
      return json({ admins });
    }

    if (action === 'create') {
      const name = String(full_name ?? '').trim();
      if (!name || !String(email ?? '').includes('@') || String(password ?? '').length < 8) {
        return json({ error: 'A name, an email and a password of 8 or more characters are required' }, 400);
      }
      const { error } = await adminClient.auth.admin.createUser({
        email: String(email).trim(),
        password: String(password),
        email_confirm: true,
        app_metadata: { role: 'admin' },
        user_metadata: { full_name: name },
      });
      if (error?.code === 'email_exists') return json({ error: 'An account with this email already exists' }, 409);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    console.error('[manage-admins]', err);
    return json({ error: 'Could not complete that. Try again.' }, 500);
  }
});
