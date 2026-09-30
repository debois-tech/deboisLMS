import type { PDFFont } from 'pdf-lib';
import type { DocumentKind } from '@/lib/types';

// Offer letter and internship certificate, drawn as real text on the letterhead. The layout follows
// temp_md/offer_letter.html and temp_md/inter_cert.html: same box, sizes, line heights and spacing.

export interface DocumentData {
  name: string;
  // The student's ID, used as the offer's Ref. No. and the certificate's number.
  code: string;
  // Already a display label, e.g. "DevOps Engineering Intern".
  role: string;
  // The offer's date.
  enrolledOn: Date;
  // The internship's first and last day: the offer's joining date, the certificate's start and end date.
  startOn: Date;
  endOn?: Date;
  // The day the certificate is issued: its date.
  issuedOn: Date;
}

export interface DocumentAssets {
  regular: Uint8Array;
  medium: Uint8Array;
  bold: Uint8Array;
  letterhead: Uint8Array;
}

const COMPANY = 'deboistech IT Solutions LLP';
const ADDRESS = 'Nashik, Maharashtra';
const PLACE = 'Nashik';

const A4 = { w: 595.28, h: 841.89 };
// The .content box of both templates: 13% each side, 19.5% from the top.
const BOX = { x: A4.w * 0.13, w: A4.w * 0.74, top: A4.h * 0.195 };
const PX = 0.75;
const BODY = 10.2;
const LINE = 1.48;

export const longDate = (date: Date) => date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

interface Run { text: string; bold?: boolean }

// "plain **bold** plain" as runs.
const runs = (text: string): Run[] => text.split('**').map((part, index) => ({ text: part, bold: index % 2 === 1 }));

interface Spec {
  title: string;
  titleSize: number;
  titleMargin: number;
  // <br> lines before the title, after it, and between the signature and the footnote.
  brBefore: number;
  brAfter: number;
  metaMargin: number;
  refLabel: string;
  recipientMargin: number;
  signatureMargin: number;
  // Footnote: <br> lines inside it, <br> lines before it, and its top margin, all as in the HTML.
  footBrInside: number;
  footBrOutside: number;
  footMargin: number;
  date: (d: DocumentData) => Date;
  paragraphs: (d: DocumentData) => string[];
}

const SPECS: Record<DocumentKind, Spec> = {
  offer_letter: {
    title: 'OFFER OF INTERNSHIP',
    titleSize: 17,
    titleMargin: 18,
    brBefore: 1,
    brAfter: 2,
    metaMargin: 13,
    refLabel: 'Ref. No.:',
    recipientMargin: 18,
    signatureMargin: 28,
    footBrInside: 11,
    footBrOutside: 0,
    footMargin: 24,
    date: (d) => d.enrolledOn,
    paragraphs: (d) => [
      `We are pleased to offer you the position of **${d.role}** at **${COMPANY}**. We are delighted to welcome you to our team and look forward to supporting your professional growth.`,
      `Your engagement will commence from **${longDate(d.startOn)}** and will be based at **${PLACE}**. Your employment will be subject to the applicable company policies, terms of employment, confidentiality obligations, and other conditions communicated by the Company.`,
      'You will be responsible for performing the duties associated with your role and any other reasonable responsibilities assigned by the Company based on business requirements.',
      'Please ensure that all information and documents provided by you are accurate and complete. This offer is subject to satisfactory verification of the same.',
      'We are confident that your association with deboistech will be a valuable and rewarding experience. We look forward to having you as a part of our team.',
    ],
  },
  cert: {
    title: 'INTERNSHIP COMPLETION CERTIFICATE',
    titleSize: 16,
    titleMargin: 24,
    brBefore: 1,
    brAfter: 1,
    metaMargin: 16,
    refLabel: 'Certificate No.:',
    recipientMargin: 22,
    signatureMargin: 30,
    footBrInside: 0,
    footBrOutside: 4,
    footMargin: 55,
    date: (d) => d.issuedOn,
    paragraphs: (d) => [
      `This is to formally certify that **${d.name}** has successfully completed an internship with **${COMPANY}** in the position of **${d.role}**.`,
      `The internship was undertaken from **${longDate(d.startOn)}** to **${longDate(d.endOn ?? d.issuedOn)}** and was based at **${PLACE}**. During this period, the candidate was associated with the Company and participated in assigned projects, tasks, and professional activities related to their role.`,
      'Throughout the internship, the candidate demonstrated commitment towards the assigned responsibilities and gained practical exposure to industry-oriented practices, technical processes, and project-based work. The candidate completed the internship period in accordance with the requirements communicated by the Company.',
      `This certificate is being issued in recognition of the successful completion of the internship and may be used as official documentation of the candidate's internship association with **${COMPANY}**.`,
      "We appreciate the candidate's contribution during the internship and wish them continued success in their academic and professional endeavors.",
    ],
  },
};

export async function buildDocumentPdf(kind: DocumentKind, data: DocumentData, assets: DocumentAssets): Promise<Uint8Array> {
  const { PDFDocument, rgb, degrees } = await import('pdf-lib');
  const fontkit = (await import('@pdf-lib/fontkit')).default;
  const spec = SPECS[kind];

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regular, medium, bold] = await Promise.all([assets.regular, assets.medium, assets.bold].map((bytes) => pdf.embedFont(bytes, { subset: true })));

  // Where the baseline sits in a line box, as a browser places it: half-leading above the font's own ascent.
  const face = fontkit.create(assets.regular) as unknown as { ascent: number; descent: number; unitsPerEm: number; hasGlyphForCodePoint: (code: number) => boolean };
  const ascent = face.ascent / face.unitsPerEm;
  const descent = face.descent / face.unitsPerEm;
  const baseline = (top: number, size: number, lineHeight: number) => top + (lineHeight * size - (ascent - descent) * size) / 2 + ascent * size;
  // A name in a script the font has no glyphs for would abort the whole document.
  const clean = (text: string) => [...text].filter((ch) => face.hasGlyphForCodePoint(ch.codePointAt(0)!)).join('');

  const page = pdf.addPage([A4.w, A4.h]);
  page.drawImage(await pdf.embedPng(assets.letterhead), { x: 0, y: 0, width: A4.w, height: A4.h });

  const ink = rgb(0x17 / 255, 0x25 / 255, 0x1f / 255);
  const green = rgb(0x12 / 255, 0x3f / 255, 0x2e / 255);
  const muted = rgb(0x5f / 255, 0x69 / 255, 0x64 / 255);

  const draw = (text: string, x: number, lineTop: number, size: number, lineHeight: number, font: PDFFont, color = ink, extra = {}) =>
    page.drawText(clean(text), { x, y: A4.h - baseline(lineTop, size, lineHeight), size, font, color, ...extra });

  // Cursor from the top of the box, and the bottom margin of the block above: adjacent margins collapse.
  let y = BOX.top;
  let margin = 0;
  const open = (top = 0) => {
    y += Math.max(margin, top * PX);
    margin = 0;
  };
  const close = (bottom = 0) => {
    margin = bottom * PX;
  };

  // <br> lines: each is one line box of the surrounding font.
  const breaks = (count: number, size = BODY) => {
    if (count === 0) return;
    open();
    y += count * size * LINE;
  };

  const width = (row: Run[], size: number) => row.reduce((sum, run) => sum + (run.bold ? bold : regular).widthOfTextAtSize(clean(run.text), size), 0);

  // One line of bold and regular runs starting at x.
  const drawRow = (row: Run[], x: number, size: number, lineHeight: number) => {
    for (const run of row) {
      const font = run.bold ? bold : regular;
      draw(run.text, x, y, size, lineHeight, font);
      x += font.widthOfTextAtSize(clean(run.text), size);
    }
  };

  // A run of lines at one size, e.g. the recipient block or the signature.
  const lines = (rows: Run[][], size: number, lineHeight: number) => {
    for (const row of rows) {
      drawRow(row, BOX.x, size, lineHeight);
      y += lineHeight * size;
    }
  };

  // Justified paragraph, every line but the last stretched to the full measure.
  const paragraph = (text: string) => {
    open();
    const words: { text: string; font: PDFFont }[][] = [];
    let word: { text: string; font: PDFFont }[] = [];
    for (const run of runs(text)) {
      const font = run.bold ? bold : regular;
      for (const part of run.text.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          if (word.length) words.push(word);
          word = [];
        } else {
          word.push({ text: part, font });
        }
      }
    }
    if (word.length) words.push(word);

    const measure = (w: { text: string; font: PDFFont }[]) => w.reduce((sum, piece) => sum + piece.font.widthOfTextAtSize(clean(piece.text), BODY), 0);
    const space = regular.widthOfTextAtSize(' ', BODY);
    const rows: (typeof words)[] = [];
    let row: typeof words = [];
    let used = 0;
    for (const w of words) {
      const next = used + (row.length ? space : 0) + measure(w);
      if (row.length && next > BOX.w) {
        rows.push(row);
        row = [];
        used = 0;
      }
      used += (row.length ? space : 0) + measure(w);
      row.push(w);
    }
    if (row.length) rows.push(row);

    rows.forEach((r, index) => {
      const natural = r.reduce((sum, w) => sum + measure(w), 0);
      const gap = index < rows.length - 1 && r.length > 1 ? (BOX.w - natural) / (r.length - 1) : space;
      let x = BOX.x;
      for (const w of r) {
        for (const piece of w) {
          draw(piece.text, x, y, BODY, LINE, piece.font);
          x += piece.font.widthOfTextAtSize(clean(piece.text), BODY);
        }
        x += gap;
      }
      y += LINE * BODY;
    });
    close(12);
  };

  // Title: centred, bold, underlined.
  breaks(spec.brBefore);
  open();
  const titleWidth = bold.widthOfTextAtSize(spec.title, spec.titleSize);
  const titleX = BOX.x + (BOX.w - titleWidth) / 2;
  draw(spec.title, titleX, y, spec.titleSize, LINE, bold, green);
  const underlineY = A4.h - (baseline(y, spec.titleSize, LINE) + spec.titleSize * 0.11);
  page.drawLine({ start: { x: titleX, y: underlineY }, end: { x: titleX + titleWidth, y: underlineY }, thickness: spec.titleSize / 18, color: green });
  y += LINE * spec.titleSize;
  close(spec.titleMargin);
  breaks(spec.brAfter);

  // Date on the left, reference on the right.
  open();
  const metaSize = 9.2;
  const left: Run[] = [{ text: 'Date:', bold: true }, { text: ` ${longDate(spec.date(data))}` }];
  const right: Run[] = [{ text: spec.refLabel, bold: true }, { text: ` ${data.code}` }];
  drawRow(left, BOX.x, metaSize, LINE);
  drawRow(right, BOX.x + BOX.w - width(right, metaSize), metaSize, LINE);
  y += LINE * metaSize;
  close(spec.metaMargin);

  // Recipient.
  open();
  lines([[{ text: 'To,', bold: true }], [{ text: data.name, bold: true }], [{ text: ADDRESS }]], BODY, 1.45);
  close(spec.recipientMargin);

  paragraph(`Dear **${data.name}**,`);
  for (const text of spec.paragraphs(data)) paragraph(text);

  // Signature.
  open(spec.signatureMargin);
  lines(
    [[{ text: 'Best Regards,' }], [{ text: 'Aditya Bankar', bold: true }], [{ text: 'Human Resources & Operations' }], [{ text: COMPANY, bold: true }]],
    BODY,
    1.45,
  );
  close();

  // Footnote.
  breaks(spec.footBrOutside);
  open(spec.footMargin);
  const noteSize = 6.5;
  y += spec.footBrInside * noteSize * LINE;
  const note = 'This is a computer-generated document and does not require any signature.';
  draw(note, BOX.x + (BOX.w - medium.widthOfTextAtSize(note, noteSize)) / 2, y, noteSize, LINE, medium, muted, { ySkew: degrees(12) });

  return pdf.save();
}
