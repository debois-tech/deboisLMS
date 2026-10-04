import { fileMimeType } from '@/lib/utils/files';

// A shared copy still advertises where it came from.
const COMPANY_NAME = 'deboistech';

const IMAGE_TYPES = ['image/png', 'image/jpeg'];

// Fits the white strip under the artwork's footer bar, ending where the green panel does. Shares of the image:
// the type size and the gap to the right edge of its width, the baseline's distance from the top of its height.
const BADGE_STAMP = { color: '#545454', size: 0.017, right: 0.076, baseline: 0.982 };

/** A student's copy of a badge: the artwork with "ID: <code>" in the bottom-right corner. Made on demand, never stored. */
export async function stampBadgeImage(image: Blob, code: string): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not prepare the badge image.');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  context.font = `400 ${Math.max(10, Math.round(canvas.width * BADGE_STAMP.size))}px Arial, Helvetica, sans-serif`;
  context.fillStyle = BADGE_STAMP.color;
  context.textAlign = 'right';
  context.fillText(`ID: ${code}`, canvas.width * (1 - BADGE_STAMP.right), canvas.height * BADGE_STAMP.baseline);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not stamp the badge image.'))), 'image/png');
  });
}

// Bakes the watermark in once, at upload — PDF or image becomes a stamped PDF, everything else passes through.
export async function stampMaterialFile(file: File): Promise<File> {
  const mimeType = fileMimeType(file);
  const isImage = IMAGE_TYPES.includes(mimeType);
  if (mimeType !== 'application/pdf' && !isImage) return file;

  const { PDFDocument, StandardFonts, degrees, rgb } = await import('pdf-lib');
  const raw = await file.arrayBuffer();

  let pdf: Awaited<ReturnType<typeof PDFDocument.create>>;
  if (isImage) {
    pdf = await PDFDocument.create();
    const image = mimeType === 'image/png' ? await pdf.embedPng(raw) : await pdf.embedJpg(raw);
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  } else {
    pdf = await PDFDocument.load(raw);
  }

  const issuedAt = new Date().toISOString().slice(0, 10);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Tiled diagonal survives crops, footer bar survives screenshots.
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();

    // Scales with the page: fixed 15pt steps meant ~4000 draw calls on a photo-sized page.
    const size = Math.min(Math.max(Math.min(width, height) / 40, 12), 48);
    const textWidth = font.widthOfTextAtSize(COMPANY_NAME, size);
    const stepX = textWidth + size * 7;
    const stepY = size * 10;

    for (let y = -height; y < height * 2; y += stepY) {
      const rowOffset = (Math.floor(y / stepY) % 2) * (stepX / 2);
      for (let x = -width; x < width * 2; x += stepX) {
        page.drawText(COMPANY_NAME, {
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
    page.drawText(`${COMPANY_NAME}  ·  ${issuedAt}`, {
      x: barHeight / 2,
      y: barHeight / 3,
      size: Math.max(11, size * 0.7),
      font: bold,
      color: rgb(1, 1, 1),
      opacity: 0.92,
    });
  }

  const stamped = await pdf.save({ useObjectStreams: false });
  const name = isImage ? file.name.replace(/\.[a-z0-9]+$/i, '.pdf') : file.name;
  return new File([stamped as BlobPart], name, { type: 'application/pdf' });
}
