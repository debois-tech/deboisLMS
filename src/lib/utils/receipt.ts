import type { PDFFont } from 'pdf-lib';

// Fee receipt, drawn as real text on a 794 x 1123 page (CSS pixels, scaled to A4 points).

interface ReceiptRow {
  label: string;
  date: Date;
  amount: number;
}

export interface ReceiptData {
  // The student's ID, printed as "Receipt No. / Student ID".
  receiptNo: string;
  date: Date;
  name: string;
  programme: string;
  email: string;
  phone: string;
  // Every payment up to and including the one this receipt is for, oldest first; the last row is "now".
  rows: ReceiptRow[];
  totalFee: number;
  mode: string;
  // Null prints a dash.
  txn: string | null;
}

export interface ReceiptAssets {
  regular: Uint8Array;
  medium: Uint8Array;
  bold: Uint8Array;
  logo: Uint8Array;
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (n: number) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : ''));
const three = (n: number) => [n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred` : '', n % 100 ? two(n % 100) : ''].filter(Boolean).join(' ');

/** Indian grouping: crore, lakh, thousand. */
function inWords(amount: number): string {
  let n = Math.round(amount);
  if (!n) return 'Zero';
  const parts: string[] = [];
  for (const [size, name] of [[1e7, 'Crore'], [1e5, 'Lakh'], [1e3, 'Thousand']] as const) {
    if (n >= size) parts.push(`${two(Math.floor(n / size) % 100)} ${name}`);
    n %= size;
  }
  if (n) parts.push(three(n));
  return parts.join(' ');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const shortDate = (d: Date) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const money = (n: number) => `${n.toLocaleString('en-IN')}.00`;

const PAGE = { w: 794, h: 1123 };
const X0 = 48;
const X1 = PAGE.w - 48;
const TOP = 48;
const BOTTOM = PAGE.h - 48;

export async function buildReceiptPdf(data: ReceiptData, assets: ReceiptAssets): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await import('pdf-lib');
  const fontkit = (await import('@pdf-lib/fontkit')).default;

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regular, medium, bold] = await Promise.all([assets.regular, assets.medium, assets.bold].map((bytes) => pdf.embedFont(bytes, { subset: true })));
  const logo = await pdf.embedPng(assets.logo);
  // A name in a script the font has no glyphs for would abort the whole document.
  const face = fontkit.create(assets.regular) as unknown as { hasGlyphForCodePoint: (code: number) => boolean };
  const clean = (text: string) => [...text].filter((ch) => face.hasGlyphForCodePoint(ch.codePointAt(0)!)).join('');

  const page = pdf.addPage([595.28, 841.89]);
  const k = 595.28 / PAGE.w;
  const hex = (value: string) => rgb(parseInt(value.slice(1, 3), 16) / 255, parseInt(value.slice(3, 5), 16) / 255, parseInt(value.slice(5, 7), 16) / 255);
  const ink = hex('#111111');
  const green = hex('#15452b');
  const grey = hex('#444444');
  const dark = hex('#333333');

  const fit = (text: string, font: PDFFont, size: number, max: number) => {
    let s = size;
    while (s > 8 && font.widthOfTextAtSize(clean(text), s * k) > max * k) s -= 0.5;
    return s;
  };

  // Text with its vertical middle at `mid`, left edge (or centre, or right edge) at x. All in template pixels.
  const text = (value: string, x: number, mid: number, size: number, font: PDFFont, color = ink, align: 'l' | 'c' | 'r' = 'l', spacing = 0) => {
    const str = clean(value);
    const width = font.widthOfTextAtSize(str, size * k) / k + spacing * str.length;
    const left = align === 'l' ? x : align === 'c' ? x - width / 2 : x - width;
    const y = (PAGE.h - (mid + size * 0.32)) * k;
    if (!spacing) {
      page.drawText(str, { x: left * k, y, size: size * k, font, color });
      return;
    }
    let at = left;
    for (const ch of str) {
      page.drawText(ch, { x: at * k, y, size: size * k, font, color });
      at += font.widthOfTextAtSize(ch, size * k) / k + spacing;
    }
  };
  const box = (x: number, top: number, w: number, h: number, fill?: ReturnType<typeof hex>) =>
    page.drawRectangle({ x: x * k, y: (PAGE.h - top - h) * k, width: w * k, height: h * k, color: fill });
  const hline = (x1: number, x2: number, y: number, thickness = 1, color = ink, dash?: number[]) =>
    page.drawLine({ start: { x: x1 * k, y: (PAGE.h - y) * k }, end: { x: x2 * k, y: (PAGE.h - y) * k }, thickness: thickness * k, color, dashArray: dash?.map((d) => d * k) });
  const vline = (x: number, y1: number, y2: number) =>
    page.drawLine({ start: { x: x * k, y: (PAGE.h - y1) * k }, end: { x: x * k, y: (PAGE.h - y2) * k }, thickness: k, color: ink });

  // Frame
  page.drawRectangle({ x: X0 * k, y: (PAGE.h - BOTTOM) * k, width: (X1 - X0) * k, height: (BOTTOM - TOP) * k, borderColor: green, borderWidth: 2 * k });
  const L = X0 + 2;
  const R = X1 - 2;
  let y = TOP + 2;

  // Letterhead strip
  const logoH = 58;
  page.drawImage(logo, { x: (L + 28) * k, y: (PAGE.h - (y + 22) - logoH) * k, width: logoH * (logo.width / logo.height) * k, height: logoH * k });
  text('DeboisTech IT Solutions LLP', R - 28, y + 31, 17, bold, green, 'r');
  text('3rd Floor, Roongta Mall, Cidco, Nashik', R - 28, y + 55, 13, regular, dark, 'r');
  text('+91 82638 30296 · enquiry@deboistech.in', R - 28, y + 75, 13, regular, dark, 'r');
  y += 102;
  hline(L, R, y, 2, green);
  y += 2;

  box(L, y, R - L, 46, green);
  text('FEE RECEIPT', (L + R) / 2 + 3, y + 23, 20, bold, hex('#ffffff'), 'c', 6);
  y += 46;

  // A label and its value on a dotted line, inside the cell between x1 and x2.
  const field = (label: string, value: string, x1: number, x2: number, mid: number, size = 16) => {
    text(label, x1 + 28, mid, 14, medium, grey);
    const start = x1 + 28 + medium.widthOfTextAtSize(clean(label), 14 * k) / k + 8;
    text(value || '—', start, mid, fit(value || '—', bold, size, x2 - 28 - start), bold);
    hline(start, x2 - 28, mid + 12, 1, hex('#777777'), [1, 2]);
  };
  const line = (cells: [string, string, number?][]) => {
    const mid = y + 23;
    const width = (R - L) / cells.length;
    cells.forEach(([label, value, size], i) => {
      field(label, value, L + i * width, L + (i + 1) * width, mid, size);
      if (i) vline(L + i * width, y, y + 46);
    });
    y += 46;
    hline(L, R, y);
  };
  line([['Receipt No. / Student ID:', data.receiptNo], ['Date:', shortDate(data.date)]]);
  line([['Received with thanks from:', data.name]]);
  line([['Programme:', data.programme]]);
  line([['Email:', data.email, 14], ['Phone:', data.phone]]);

  // Payments table. Columns: Sr, Particulars, Date, Status, Amount.
  const colAmount = R - 140;
  const colStatus = colAmount - 118;
  const colDate = colStatus - 120;
  const colPart = L + 56;
  const dividers = [colPart, colDate, colStatus, colAmount];
  box(L, y, R - L, 38, hex('#e9f0eb'));
  const headMid = y + 19;
  text('SR.', L + 14, headMid, 13, bold, ink, 'l', 1);
  text('PARTICULARS', colPart + 14, headMid, 13, bold, ink, 'l', 1);
  text('DATE', (colDate + colStatus) / 2, headMid, 13, bold, ink, 'c', 1);
  text('STATUS', (colStatus + colAmount) / 2, headMid, 13, bold, ink, 'c', 1);
  text('AMOUNT (INR)', R - 14, headMid, 13, bold, ink, 'r', 1);
  dividers.forEach((x) => vline(x, y, y + 38));
  y += 38;
  hline(L, R, y);

  // What is left for the rows once the fixed blocks and a short note are placed.
  const FIXED = 3 * 44 + 50 + 46 + 43 + 41 + 56;
  const room = BOTTOM - 2 - y - FIXED;
  // ponytail: more payments than fit are folded into one "Earlier payments" row, enough for any real fee.
  const fits = Math.max(1, Math.floor(room / 26));
  let rows = data.rows;
  let offset = 0;
  if (rows.length > fits) {
    const folded = rows.slice(0, rows.length - fits + 1);
    offset = folded.length - 1;
    rows = [{ label: `Earlier payments (${folded.length})`, date: folded[folded.length - 1].date, amount: folded.reduce((sum, r) => sum + r.amount, 0) }, ...rows.slice(folded.length)];
  }
  const rowH = Math.min(44, Math.floor(room / rows.length));
  rows.forEach((row, i) => {
    const mid = y + rowH / 2;
    const now = i === rows.length - 1;
    if (now) box(L, y, R - L, rowH, hex('#e9f6ee'));
    const font = now ? bold : regular;
    text(i === 0 && offset ? `1-${offset + 1}` : String(i + 1 + offset), L + 14, mid, 16, font);
    text(row.label, colPart + 14, mid, fit(row.label, font, 16, colDate - colPart - 28), font);
    text(shortDate(row.date), (colDate + colStatus) / 2, mid, 14, font, ink, 'c');
    text('Paid', (colStatus + colAmount) / 2, mid, 14, bold, hex('#217535'), 'c');
    text(money(row.amount), R - 14, mid, 16, font, ink, 'r');
    dividers.forEach((x) => vline(x, y, y + rowH));
    y += rowH;
  });
  const gap = Math.min(60, Math.max(0, room - rows.length * rowH));
  dividers.forEach((x) => vline(x, y, y + gap));
  y += gap;

  const paid = data.rows.reduce((sum, r) => sum + r.amount, 0);
  const totals: [string, number, boolean][] = [['Total fee', data.totalFee, false], ['Paid till now', paid, false], ['Balance due', Math.max(data.totalFee - paid, 0), true]];
  for (const [label, value, strong] of totals) {
    hline(L, R, y);
    const mid = y + 22;
    text(label, colStatus - 14, mid, 16, strong ? bold : regular, ink, 'r');
    text(money(value), R - 14, mid, 16, strong ? bold : regular, ink, 'r');
    [colPart, colStatus, colAmount].forEach((x) => vline(x, y, y + 44));
    y += 44;
  }
  hline(L, R, y);

  const current = data.rows[data.rows.length - 1];
  const spoken = `Rupees ${inWords(current.amount)} only`;
  text('Received now, in words:', L + 28, y + 25, 15, regular);
  const wordsAt = L + 28 + regular.widthOfTextAtSize('Received now, in words: ', 15 * k) / k;
  text(spoken, wordsAt, y + 25, fit(spoken, bold, 15, R - 28 - wordsAt), bold);
  y += 50;
  hline(L, R, y);

  const half = (R - L) / 2;
  field('Payment mode:', data.mode, L, L + half, y + 23);
  field('Transaction ref:', data.txn ?? '—', L + half, R, y + 23);
  vline(L + half, y, y + 46);
  y += 46;
  hline(L, R, y);

  // The note wraps at the frame width; the stamp and footer sit on the bottom edge.
  const words = "Fees once paid are subject to the program's refund terms. Please keep this receipt for your records.".split(' ');
  const wrapped: string[] = [];
  for (const word of words) {
    const last = wrapped[wrapped.length - 1];
    if (last !== undefined && regular.widthOfTextAtSize(`${last} ${word}`, 13 * k) / k <= R - L - 56) wrapped[wrapped.length - 1] = `${last} ${word}`;
    else wrapped.push(word);
  }
  wrapped.forEach((row, i) => text(row, L + 28, y + 30 + i * 22, 13, regular, dark));

  const footTop = BOTTOM - 2 - 41;
  hline(L, R, footTop, 2, green);
  text('deboistech IT Solutions LLP | Building technology, Creating values.', L + 28, footTop + 22, 12.5, regular, dark);
  text('www.deboistech.in', R - 28, footTop + 22, 12.5, regular, dark, 'r');
  const stampTop = footTop - 43;
  hline(L, R, stampTop, 1, green, [3, 3]);
  text('This is a computer-generated receipt. No signature is required.', (L + R) / 2, stampTop + 22, 13, bold, green, 'c');

  return pdf.save();
}
