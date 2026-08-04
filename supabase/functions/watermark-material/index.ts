// Edge Function: watermark-material
// The only reader of the private `materials` bucket. Given a material id and the
// caller's JWT, it fetches the original PDF with the service role key, stamps the
// tutor's name and the company phone number onto every page, and streams back
// that copy.
//
// The stamp is deliberately NOT the reading student's identity. A shared copy is
// treated as reach rather than theft: whoever ends up with the file also ends up
// with the tutor's name and a number to call. `material_views` still records who
// opened what, so opens remain auditable even though the page no longer names
// the reader.
//
// The unstamped file never reaches a browser.
//
// Deploy: supabase functions deploy watermark-material

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { degrees, PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });

/** Per-student throttle. Generous enough for real reading, tight enough to stop a loop. */
const THROTTLE_SECONDS = 60;
const THROTTLE_MAX_OPENS = 20;

/** Shown on every page, under every tutor name. */
const COMPANY_NAME = 'DeboisTech';
const COMPANY_PHONE = '8263830296';

/**
 * pdf-lib holds the whole document in memory and serialises a second copy, inside
 * an Edge Function's ~256 MB budget. Past this the function is killed mid-render
 * and the student sees a generic failure, so it is rejected with a real reason.
 *
 * The bucket enforces the same 50 MB, so this should be unreachable — it stays as
 * the backstop for anything uploaded before that limit was set.
 */
const MAX_WATERMARK_BYTES = 50 * 1024 * 1024;

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

    // Tiled diagonal, sized to be legible in a screenshot that has been scaled
    // down or re-shared. Opacity stays low so the material underneath is still
    // readable — a watermark that makes the page hard to read gets cropped out.
    const size = 15;
    const textWidth = font.widthOfTextAtSize(identity, size);
    const stepX = textWidth + 110;
    const stepY = 150;

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
          opacity: 0.16,
          rotate: degrees(35),
        });
      }
    }

    // Footer bar, drawn last so it sits above the page content.
    const barHeight = 24;
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height: barHeight,
      color: rgb(0.04, 0.06, 0.05),
      opacity: 0.88,
    });
    page.drawText(`${identity}  ·  ${issuedAt}`, {
      x: 12,
      y: 8,
      size: 11,
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
      .select('id, batch_id, title, storage_path, size_bytes, tutor:tutors(name)')
      .eq('id', material_id)
      .single();

    if (!material) return json({ error: 'Material not found.' }, 404);

    if ((material.size_bytes ?? 0) > MAX_WATERMARK_BYTES) {
      return json(
        { error: 'This file is too large to open in the reader. Ask your coordinator for it.' },
        413,
      );
    }

    /*
     * The stamp is the same for everyone: the tutor who taught it, the company,
     * and the number to call. It does not vary by reader, which is the point —
     * a shared copy still advertises where it came from.
     */
    const tutorName = (material.tutor as { name?: string } | null)?.name;
    const identity = [tutorName, COMPANY_NAME, COMPANY_PHONE].filter(Boolean).join(' · ');

    const role = caller.app_metadata?.role;
    let studentId: string | null = null;

    if (role !== 'admin') {
      const { data: student } = await admin
        .from('students')
        .select('id, name, phone')
        .eq('auth_user_id', caller.id)
        .single();

      if (!student) return json({ error: 'This login is not linked to a student record.' }, 403);

      /*
       * Enrolment is re-checked here rather than trusted from the client: this
       * function runs as the service role and bypasses RLS, so it has to do the
       * work the policy would otherwise have done.
       *
       * A null batch_id means the material is for every student, so there is no
       * enrolment to check — miss this and every all-students material 403s.
       */
      if (material.batch_id) {
        const { data: mapping } = await admin
          .from('batch_student_mapping')
          .select('id')
          .eq('student_id', student.id)
          .eq('batch_id', material.batch_id)
          .eq('status', 'active')
          .maybeSingle();

        if (!mapping) return json({ error: 'This material is not for your batch.' }, 403);
      }

      /*
       * Throttle. Every call downloads the whole PDF, stamps every page and
       * re-serialises it, so a loop from one logged-in student burns the free
       * tier's invocation budget and floods `material_views` — the table a leak
       * investigation depends on.
       *
       * The view log doubles as the rate-limit store: no extra table, and it is
       * already written on every successful open.
       */
      const since = new Date(Date.now() - THROTTLE_SECONDS * 1000).toISOString();
      const { count: recentOpens } = await admin
        .from('material_views')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', student.id)
        .gte('viewed_at', since);

      if ((recentOpens ?? 0) >= THROTTLE_MAX_OPENS) {
        return json(
          { error: 'You are opening material too quickly. Wait a moment and try again.' },
          429,
          { 'Retry-After': String(THROTTLE_SECONDS) },
        );
      }

      studentId = student.id;
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
