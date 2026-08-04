// Edge Function: watermark-material
// The only reader of the private `materials` bucket. Given a material id and the
// caller's JWT, it fetches the original PDF with the service role key, stamps the
// reading student's name and phone onto every page, and streams back that copy.
//
// The unstamped file never reaches a browser. Screenshots and screen recordings
// are still possible — no web technology prevents them — but every copy in
// circulation carries the identity of the student who opened it.
//
// Deploy: supabase functions deploy watermark-material

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { degrees, PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * Two layers, because they defeat different things. The tiled diagonal layer
 * survives a crop — any fragment large enough to read still carries a full
 * identity string. The footer bar survives a downscaled screenshot, where the
 * tiled text turns to mush but a solid strip stays legible.
 */
async function stamp(pdfBytes: ArrayBuffer, identity: string, issuedAt: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();

    // Tiled diagonal. Low opacity so the material stays readable underneath —
    // a watermark that makes the page hard to read gets worked around.
    const size = 11;
    const textWidth = font.widthOfTextAtSize(identity, size);
    const stepX = textWidth + 90;
    const stepY = 130;

    for (let y = -height; y < height * 2; y += stepY) {
      // Offset alternate rows so the tiling doesn't leave clean vertical gutters
      // a crop could fall into.
      const rowOffset = (Math.floor(y / stepY) % 2) * (stepX / 2);
      for (let x = -width; x < width * 2; x += stepX) {
        page.drawText(identity, {
          x: x + rowOffset,
          y,
          size,
          font,
          color: rgb(0.45, 0.45, 0.45),
          opacity: 0.13,
          rotate: degrees(35),
        });
      }
    }

    // Footer bar, drawn last so it sits above the page content.
    const barHeight = 18;
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height: barHeight,
      color: rgb(0.04, 0.06, 0.05),
      opacity: 0.88,
    });
    page.drawText(`${identity}  ·  opened ${issuedAt}`, {
      x: 10,
      y: 5.5,
      size: 8,
      font: bold,
      color: rgb(1, 1, 1),
      opacity: 0.92,
    });
  }

  // `useObjectStreams: false` keeps the output readable by older PDF viewers,
  // which some students will be on.
  return await pdf.save({ useObjectStreams: false });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { material_id } = await req.json();
    if (!material_id) return json({ error: 'material_id is required' }, 400);

    // Identify the caller from their own JWT, never from the request body — the
    // body is attacker-controlled and would let anyone request anyone's copy.
    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: 'Sign in to open this material.' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SECRET_SERVICE_ROLE_KEY')!,
    );

    const { data: material } = await admin
      .from('materials')
      .select('id, batch_id, title, storage_path')
      .eq('id', material_id)
      .single();

    if (!material) return json({ error: 'Material not found.' }, 404);

    const role = caller.app_metadata?.role;
    let identity: string;
    let studentId: string | null = null;

    if (role === 'admin') {
      // Admins get a copy stamped as theirs, not an unstamped one. An admin
      // preview that leaks should be as traceable as a student's.
      identity = `${caller.email ?? 'Admin'} · DeboisTech admin`;
    } else {
      const { data: student } = await admin
        .from('students')
        .select('id, name, phone')
        .eq('auth_user_id', caller.id)
        .single();

      if (!student) return json({ error: 'This login is not linked to a student record.' }, 403);

      // Enrolment is re-checked here rather than trusted from the client: this
      // function runs as the service role and bypasses RLS, so it has to do the
      // work the policy would otherwise have done.
      const { data: mapping } = await admin
        .from('batch_student_mapping')
        .select('id')
        .eq('student_id', student.id)
        .eq('batch_id', material.batch_id)
        .eq('status', 'active')
        .maybeSingle();

      if (!mapping) return json({ error: 'This material is not for your batch.' }, 403);

      studentId = student.id;
      identity = [student.name, student.phone].filter(Boolean).join(' · ');
    }

    const { data: file, error: downloadError } = await admin.storage
      .from('materials')
      .download(material.storage_path);

    if (downloadError || !file) return json({ error: 'The file is missing from storage.' }, 404);

    const issuedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const stamped = await stamp(await file.arrayBuffer(), identity, issuedAt);

    // Logged after the stamp succeeds, so the log records real opens only.
    if (studentId) {
      await admin.from('material_views').insert({ material_id: material.id, student_id: studentId });
    }

    return new Response(stamped, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        // Never cached: each copy is personal and every open should be logged.
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Content-Disposition': 'inline',
      },
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
