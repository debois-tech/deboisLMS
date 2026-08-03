// Edge Function: create-student-login
// Creates (or resets) a Supabase Auth login for a student row, using the
// service role key — this must run server-side, never in the browser bundle.
//
// Deploy: supabase functions deploy create-student-login
// Invoke from the app: supabase.functions.invoke('create-student-login', { body: { student_id } })

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function generatePassword(phone: string | null): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  const suffix = digits.length >= 4 ? digits.slice(-4) : Math.floor(100000 + Math.random() * 900000).toString();
  return `Debois@${suffix}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { student_id } = await req.json();
    if (!student_id) {
      return new Response(JSON.stringify({ error: 'student_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Caller must be logged in as admin — verified using the caller's own JWT,
    // not the service role key, so a non-admin can't hit this function directly.
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
      .select('id, email, phone, auth_user_id')
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

    const password = generatePassword(student.phone);

    if (student.auth_user_id) {
      // Reset flow: student already has a login, just rotate the password.
      const { error } = await adminClient.auth.admin.updateUserById(student.auth_user_id, { password });
      if (error) throw error;
    } else {
      // First-time flow: create the auth user and link it back to the student row.
      const { data: created, error } = await adminClient.auth.admin.createUser({
        email: student.email,
        password,
        email_confirm: true,
        app_metadata: { role: 'student', student_id: student.id },
      });
      if (error) throw error;

      await adminClient
        .from('students')
        .update({ auth_user_id: created.user.id })
        .eq('id', student.id);
    }

    return new Response(JSON.stringify({ email: student.email, password }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
