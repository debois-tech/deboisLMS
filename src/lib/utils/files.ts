/** Three fates by MIME type: `paged` (watermarked), `text` (as-is), `download` (everything else). */
export type MaterialKind = 'paged' | 'text' | 'download';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const TEXT_TYPES = ['text/markdown', 'text/plain', 'text/x-markdown'];

export const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Extensions, not MIME types: a folder pick reports half of these as an empty string. */
export const ACCEPTED_EXTENSIONS = [
  'pdf', 'png', 'jpg', 'jpeg', 'webp', 'md', 'txt', 'docx',
  'xlsx', 'pptx', 'csv', 'json', 'zip',
] as const;

export const ACCEPTED_TYPES: ReadonlySet<string> = new Set(ACCEPTED_EXTENSIONS);

/** The `accept` attribute for every file picker that feeds this pipeline. */
export const ACCEPTED_FILE_ACCEPT = ACCEPTED_EXTENSIONS.map((ext) => `.${ext}`).join(',');

/** Per-file upload limit, matching the bucket and what the watermarker can hold. */
export const MATERIAL_MAX_BYTES = 50 * 1024 * 1024;

/** Extension decides whenever the MIME type is missing or generic. */
export function fileMimeType(file: File): string {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const ext = extensionOf(file.name);
  if (ext === 'md') return 'text/markdown';
  if (ext === 'txt') return 'text/plain';
  if (ext === 'csv') return 'text/csv';
  if (ext === 'json') return 'application/json';
  if (ext === 'zip') return 'application/zip';
  if (ext === 'pdf') return 'application/pdf';
  return 'application/octet-stream';
}

export function extensionOf(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  return match ? match[1].toLowerCase() : '';
}

export function materialKind(mimeType?: string | null): MaterialKind {
  if (!mimeType) return 'download';
  if (mimeType === 'application/pdf' || IMAGE_TYPES.includes(mimeType)) return 'paged';
  // text/csv is deliberately not here: a spreadsheet export is opened in a
  // spreadsheet, not read down the page.
  if (TEXT_TYPES.includes(mimeType)) return 'text';
  return 'download';
}

export function isImageType(mimeType?: string | null): boolean {
  return Boolean(mimeType && IMAGE_TYPES.includes(mimeType));
}

/** Short label for a file row — "PDF", "Word", "Image". */
export function fileTypeLabel(mimeType?: string | null, name?: string): string {
  if (mimeType === 'application/pdf') return 'PDF';
  if (isImageType(mimeType)) return 'Image';
  if (materialKind(mimeType) === 'text') return 'Text';
  const ext = extensionOf(name ?? '');
  if (ext === 'xlsx' || ext === 'csv') return 'Sheet';
  if (ext === 'pptx') return 'Slides';
  if (ext === 'zip') return 'Archive';
  return ext ? ext.toUpperCase() : 'File';
}

/** Longest edge kept on upload. pdf-lib decodes PNG to raw RGBA, so a 12MP shot OOMs the watermarker. */
export const MAX_IMAGE_EDGE = 2400;

/** WebP to PNG (pdf-lib cannot embed WebP) and downscale past MAX_IMAGE_EDGE. Small PNG/JPEG passes through. */
export async function prepareImageForUpload(file: File): Promise<File> {
  const type = fileMimeType(file);
  if (!IMAGE_TYPES.includes(type)) return file;

  const bitmap = await createImageBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > MAX_IMAGE_EDGE ? MAX_IMAGE_EDGE / longest : 1;

  if (scale === 1 && type !== 'image/webp') {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Could not read that image.');
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // JPEG stays JPEG: pdf-lib embeds it without decoding, which is the cheap path.
  const outType = type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, outType, outType === 'image/jpeg' ? 0.92 : undefined),
  );
  if (!blob) throw new Error(`Could not convert ${file.name}.`);

  const name = outType === 'image/png' ? file.name.replace(/\.webp$/i, '.png') : file.name;
  return new File([blob], name, { type: outType });
}

/** Text only — rebuilt from mammoth's raw text, not Word's layout. Libraries imported lazily. */
export async function docxToPdf(file: File): Promise<File> {
  const [{ default: mammoth }, { PDFDocument, StandardFonts }] = await Promise.all([
    import('mammoth/mammoth.browser'),
    import('pdf-lib'),
  ]);

  const { value: raw } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const size = 11;
  const lineHeight = size * 1.6;
  const margin = 56;

  // A4 at 72dpi. Lines are wrapped against the measured width of the real font,
  // so a long command does not run off the page.
  const pageWidth = 595;
  const pageHeight = 842;
  const maxWidth = pageWidth - margin * 2;

  const lines: string[] = [];
  for (const paragraph of raw.split(/\r?\n/)) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // A single word wider than the page (a URL, a long path) is cut to fit
      // rather than silently clipped at the margin.
      line = word;
      while (font.widthOfTextAtSize(line, size) > maxWidth && line.length > 1) {
        let cut = line.length;
        while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > maxWidth) cut -= 1;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    lines.push(line);
  }

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  for (const line of lines) {
    if (y < margin) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    if (line) page.drawText(line, { x: margin, y, size, font });
    y -= lineHeight;
  }

  if (lines.every((line) => !line)) {
    throw new Error('That document has no readable text.');
  }

  const bytes = await pdf.save();
  const name = file.name.replace(/\.docx$/i, '.pdf');
  return new File([bytes as BlobPart], name, { type: 'application/pdf' });
}
