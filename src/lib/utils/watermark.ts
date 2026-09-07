import { fileMimeType } from '@/lib/utils/files';

// A shared copy still advertises where it came from.
const COMPANY_NAME = 'deboistech';

const IMAGE_TYPES = ['image/png', 'image/jpeg'];

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
