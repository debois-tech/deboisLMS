import type { Batch, DocumentKind, Student } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';

const TITLES: Record<DocumentKind, string> = {
  offer_letter: 'Offer Letter',
  cert: 'Certificate of Completion',
};

const BODY: Record<DocumentKind, (studentName: string, batchName: string) => string> = {
  offer_letter: (name, batch) => `This confirms the enrolment of ${name} in ${batch} at Deboistech.`,
  cert: (name, batch) => `This certifies that ${name} has successfully completed ${batch} at Deboistech.`,
};

/** Dummy A4 template. Filled once, right when a student is added — see queries/documents.ts. */
export async function generateDocumentPdf(kind: DocumentKind, student: Student, batch: Batch): Promise<File> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const width = 842; // A4 landscape at 72dpi
  const height = 595;
  const page = pdf.addPage([width, height]);
  const margin = 40;

  page.drawRectangle({
    x: margin,
    y: margin,
    width: width - margin * 2,
    height: height - margin * 2,
    borderColor: rgb(0.1, 0.35, 0.3),
    borderWidth: 2,
  });

  const center = (text: string, size: number, useFont = font) =>
    (width - useFont.widthOfTextAtSize(text, size)) / 2;

  page.drawText('DEBOISTECH', { x: center('DEBOISTECH', 16, bold), y: height - 90, size: 16, font: bold, color: rgb(0.1, 0.35, 0.3) });

  const title = TITLES[kind];
  page.drawText(title, { x: center(title, 30, bold), y: height - 220, size: 30, font: bold });

  const name = student.name;
  page.drawText(name, { x: center(name, 22, bold), y: height - 290, size: 22, font: bold, color: rgb(0.1, 0.35, 0.3) });

  const body = BODY[kind](student.name, batch.name);
  page.drawText(body, { x: center(body, 13), y: height - 330, size: 13, font, color: rgb(0.3, 0.3, 0.3) });

  const issued = `Issued ${formatDate(new Date().toISOString())}`;
  page.drawText(issued, { x: center(issued, 11), y: margin + 30, size: 11, font, color: rgb(0.5, 0.5, 0.5) });

  const bytes = await pdf.save();
  return new File([bytes as BlobPart], `${title.replace(/\s+/g, '-')}-${student.student_code ?? student.id}.pdf`, {
    type: 'application/pdf',
  });
}
