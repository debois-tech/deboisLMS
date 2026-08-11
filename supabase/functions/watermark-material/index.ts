
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

/** The whole stamp: a shared copy still advertises where it came from. */
const COMPANY_NAME = 'deboistech';

/**
 * pdf-lib holds the whole document in memory, so past this size the function is
 * killed mid-render. Backstop for anything uploaded before the bucket limit was set.
 */
const MAX_WATERMARK_BYTES = 50 * 1024 * 1024;

const IMAGE_TYPES = ['image/png', 'image/jpeg'];

/**
 * An image becomes a one-page PDF sized to it, so the stamping and the paged
 * reader below work on a photo exactly as they do on a document. WebP is absent
 * because pdf-lib cannot embed it — the browser converts those to PNG on upload.
 */
async function imageToPdf(bytes: ArrayBuffer, mimeType: string): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  const image = mimeType === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  const page = pdf.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  const saved = await pdf.save({ useObjectStreams: false });
  return saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer;
}

/** Two layers: the tiled diagonal survives crops, the footer bar survives downscaled screenshots. */
async function stamp(pdfBytes: ArrayBuffer, identity: string, issuedAt: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();

    const size = 15;
    const textWidth = font.widthOfTextAtSize(identity, size);
    const stepX = textWidth + 110;
    const stepY = 150;

    for (let y = -height; y < height * 2; y += stepY) {
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

  return await pdf.save({ useObjectStreams: false });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { material_id } = await req.json();
    if (!material_id) return json({ error: 'material_id is required' }, 400);

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
      .select('id, batch_id, title, storage_path, size_bytes, mime_type')
      .eq('id', material_id)
      .single();

    if (!material) return json({ error: 'Material not found.' }, 404);

    if ((material.size_bytes ?? 0) > MAX_WATERMARK_BYTES) {
      return json(
        { error: 'This file is too large to open in the reader. Ask your coordinator for it.' },
        413,
      );
    }

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
       * Enrolment is re-checked here because this function runs as the service
       * role and bypasses RLS. A null batch_id means it's for every student, so
       * there is no enrolment to check.
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
       * Throttle: every call downloads and re-stamps the whole PDF, and the view
       * log doubles as the rate-limit store — it is already written on every open.
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

    // The view log is written for every kind, watermarked or not: it is the half
    // of the trail that says who opened what, and a .zip needs that most.
    if (studentId) {
      await admin.from('material_views').insert({ material_id: material.id, student_id: studentId });
    }

    const mimeType = material.mime_type ?? 'application/pdf';
    const noStore = {
      ...corsHeaders,
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    };

    // Anything the reader cannot page — text, sheets, decks, archives — goes back
    // untouched. There is no way to stamp a .zip, and re-encoding one would only
    // break it.
    if (mimeType !== 'application/pdf' && !IMAGE_TYPES.includes(mimeType)) {
      return new Response(await file.arrayBuffer(), {
        headers: { ...noStore, 'Content-Type': mimeType, 'Content-Disposition': 'inline' },
      });
    }

    const raw = await file.arrayBuffer();
    const pdfBytes = IMAGE_TYPES.includes(mimeType) ? await imageToPdf(raw, mimeType) : raw;
    const issuedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const stamped = await stamp(pdfBytes, COMPANY_NAME, issuedAt);

    return new Response(stamped, {
      headers: { ...noStore, 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline' },
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
