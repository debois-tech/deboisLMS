
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { degrees, PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';

/** Origins allowed to call this. Unset means '*' — set ALLOWED_ORIGINS at deploy. */
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
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

const json = (req: Request, body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsFor(req), 'Content-Type': 'application/json', ...extraHeaders },
  });

/** Per-student throttle. Generous enough for real reading, tight enough to stop a loop. */
const THROTTLE_SECONDS = 60;
const THROTTLE_MAX_OPENS = 20;

/** The whole stamp: a shared copy still advertises where it came from. */
const COMPANY_NAME = 'deboistech';

/** pdf-lib holds the whole document in memory; past this the function is killed mid-render. */
const MAX_WATERMARK_BYTES = 50 * 1024 * 1024;

/** PNG decodes to raw RGBA several times over — past this the function runs out of memory. */
const MAX_IMAGE_PIXELS = 12_000_000;

const IMAGE_TYPES = ['image/png', 'image/jpeg'];

/** Tiled diagonal survives crops, footer bar survives screenshots. No save/load round trip. */
async function stamp(pdf: PDFDocument, identity: string, issuedAt: string): Promise<void> {
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();

    // Scales with the page: fixed 15pt steps meant ~4000 draw calls on a photo-sized page.
    const size = Math.min(Math.max(Math.min(width, height) / 40, 12), 48);
    const textWidth = font.widthOfTextAtSize(identity, size);
    const stepX = textWidth + size * 7;
    const stepY = size * 10;

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

    const barHeight = Math.max(24, size * 1.6);
    page.drawRectangle({
      x: 0,
      y: 0,
      width,
      height: barHeight,
      color: rgb(0.04, 0.06, 0.05),
      opacity: 0.88,
    });
    page.drawText(`${identity}  ·  ${issuedAt}`, {
      x: barHeight / 2,
      y: barHeight / 3,
      size: Math.max(11, size * 0.7),
      font: bold,
      color: rgb(1, 1, 1),
      opacity: 0.92,
    });
  }
}

/** An image becomes a one-page PDF. WebP absent: pdf-lib cannot embed it. */
async function imageToPdf(bytes: ArrayBuffer, mimeType: string): Promise<PDFDocument> {
  const pdf = await PDFDocument.create();
  const image = mimeType === 'image/png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);

  if (image.width * image.height > MAX_IMAGE_PIXELS) {
    throw new Error('IMAGE_TOO_LARGE');
  }

  const page = pdf.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  return pdf;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsFor(req) });
  }

  try {
    const { material_id } = await req.json();
    if (!material_id) return json(req, { error: 'material_id is required' }, 400);

    const authHeader = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json(req, { error: 'Sign in to open this material.' }, 401);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SECRET_SERVICE_ROLE_KEY')!,
    );

    const { data: material } = await admin
      .from('materials')
      .select('id, batch_id, title, storage_path, size_bytes, mime_type')
      .eq('id', material_id)
      .single();

    if (!material) return json(req, { error: 'Material not found.' }, 404);

    if ((material.size_bytes ?? 0) > MAX_WATERMARK_BYTES) {
      return json(
        req,
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

      if (!student) return json(req, { error: 'This login is not linked to a student record.' }, 403);

      // Re-checked because this runs as the service role and bypasses RLS.
      if (material.batch_id) {
        const { data: mapping } = await admin
          .from('batch_student_mapping')
          .select('id')
          .eq('student_id', student.id)
          .eq('batch_id', material.batch_id)
          .eq('status', 'active')
          .maybeSingle();

        if (!mapping) return json(req, { error: 'This material is not for your batch.' }, 403);
      }

      // The view log doubles as the rate-limit store; it is written on every open anyway.
      const since = new Date(Date.now() - THROTTLE_SECONDS * 1000).toISOString();
      const { count: recentOpens } = await admin
        .from('material_views')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', student.id)
        .gte('viewed_at', since);

      if ((recentOpens ?? 0) >= THROTTLE_MAX_OPENS) {
        return json(
          req,
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

    if (downloadError || !file) return json(req, { error: 'The file is missing from storage.' }, 404);

    // The view log is written for every kind, watermarked or not: it is the half
    // of the trail that says who opened what, and a .zip needs that most.
    if (studentId) {
      await admin.from('material_views').insert({ material_id: material.id, student_id: studentId });
    }

    const mimeType = material.mime_type ?? 'application/pdf';
    const noStore = {
      ...corsFor(req),
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    };

    // Unpageable kinds go back untouched — a .zip cannot be stamped, only broken.
    if (mimeType !== 'application/pdf' && !IMAGE_TYPES.includes(mimeType)) {
      return new Response(await file.arrayBuffer(), {
        headers: { ...noStore, 'Content-Type': mimeType, 'Content-Disposition': 'inline' },
      });
    }

    const raw = await file.arrayBuffer();
    const issuedAt = new Date().toISOString().slice(0, 16).replace('T', ' ');

    // One document throughout: the old save/copy/reload held three copies of a decoded image.
    let pdf: PDFDocument;
    try {
      pdf = IMAGE_TYPES.includes(mimeType)
        ? await imageToPdf(raw, mimeType)
        : await PDFDocument.load(raw);
    } catch (err) {
      const tooBig = (err as Error).message === 'IMAGE_TOO_LARGE'
        || /allocat|out of memory/i.test((err as Error).message);
      console.error('[watermark-material] could not open', material.id, err);
      return json(
        req,
        {
          error: tooBig
            ? 'This image is too large for the reader. Ask your coordinator to re-upload it.'
            : 'This file could not be opened. It may be damaged.',
        },
        tooBig ? 413 : 422,
      );
    }

    await stamp(pdf, COMPANY_NAME, issuedAt);
    const stamped = await pdf.save({ useObjectStreams: false });

    return new Response(stamped, {
      headers: { ...noStore, 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline' },
    });
  } catch (err) {
    // Logged in full, returned as a generic line: the raw text names internal
    // tables and library internals the caller has no business seeing.
    console.error('[watermark-material]', err);
    return json(req, { error: 'Could not open this material. Try again.' }, 500);
  }
});
