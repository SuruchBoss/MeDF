import { PDFDocument, rgb } from 'pdf-lib';
import type { Locale } from '../i18n/locales';
import { FontBook, type FontLoader } from './fonts';

/**
 * Builds a small contract so a visitor can try the editor immediately, without
 * having to find a PDF of their own. Generated with pdf-lib, which the app
 * already ships, so it costs no extra download.
 *
 * The copy lives here rather than in the message dictionaries: this is a
 * *document*, not interface text. Its lines carry their own type size and
 * spacing, and a translator returning a bare string could not express that.
 */

interface Line {
  text: string;
  size: number;
  /** Space to the next line, in points. */
  gap: number;
  bold?: boolean;
}

const DOTS = '................................................';

const TH: { lines: Line[]; signatures: [string, string]; footer: string } = {
  lines: [
    { text: 'สัญญาจ้างทำงาน', size: 20, gap: 34, bold: true },
    { text: 'ทำที่ กรุงเทพมหานคร', size: 12, gap: 20 },
    { text: 'วันที่ ......... เดือน ................... พ.ศ. ..........', size: 12, gap: 30 },
    { text: `สัญญาฉบับนี้ทำขึ้นระหว่าง ${DOTS} ซึ่งต่อไปในสัญญานี้จะเรียกว่า “ผู้ว่าจ้าง” ฝ่ายหนึ่ง`, size: 11.5, gap: 18 },
    { text: `กับ ${DOTS} ซึ่งต่อไปในสัญญานี้จะเรียกว่า “ผู้รับจ้าง” อีกฝ่ายหนึ่ง`, size: 11.5, gap: 26 },
    { text: 'ข้อ 1. ขอบเขตของงาน', size: 13, gap: 18, bold: true },
    { text: 'ผู้รับจ้างตกลงรับจ้างทำงานให้แก่ผู้ว่าจ้าง ตามรายละเอียดที่กำหนดไว้ในเอกสารแนบท้ายสัญญา', size: 11.5, gap: 16 },
    { text: 'โดยจะส่งมอบงานให้ครบถ้วนภายในกำหนดเวลาที่ทั้งสองฝ่ายได้ตกลงกันไว้', size: 11.5, gap: 26 },
    { text: 'ข้อ 2. ค่าจ้างและการชำระเงิน', size: 13, gap: 18, bold: true },
    { text: 'ผู้ว่าจ้างตกลงชำระค่าจ้างเป็นจำนวนเงิน .................... บาท (........................................)', size: 11.5, gap: 16 },
    { text: 'ภายใน 15 วันนับจากวันที่ผู้ว่าจ้างได้ตรวจรับงานเรียบร้อยแล้ว', size: 11.5, gap: 26 },
    { text: 'ข้อ 3. การเลิกสัญญา', size: 13, gap: 18, bold: true },
    { text: 'คู่สัญญาฝ่ายใดฝ่ายหนึ่งอาจบอกเลิกสัญญาได้ โดยแจ้งให้อีกฝ่ายทราบเป็นหนังสือล่วงหน้าไม่น้อยกว่า 30 วัน', size: 11.5, gap: 40 },
    { text: 'ทั้งสองฝ่ายได้อ่านและเข้าใจข้อความในสัญญานี้โดยละเอียดแล้ว จึงได้ลงลายมือชื่อไว้เป็นหลักฐาน', size: 11.5, gap: 60 },
  ],
  signatures: [
    'ลงชื่อ ................................ ผู้ว่าจ้าง',
    'ลงชื่อ ................................ ผู้รับจ้าง',
  ],
  footer: 'หน้า 1 / 1 · เอกสารตัวอย่างสำหรับทดลองใช้ MeDF',
};

const EN: typeof TH = {
  lines: [
    { text: 'Services Agreement', size: 20, gap: 34, bold: true },
    { text: 'Made in ................................', size: 12, gap: 20 },
    { text: 'Dated the ......... day of ................... 20 ......', size: 12, gap: 30 },
    { text: `This agreement is made between ${DOTS} (“the Client”)`, size: 11.5, gap: 18 },
    { text: `and ${DOTS} (“the Contractor”).`, size: 11.5, gap: 26 },
    { text: '1. Scope of work', size: 13, gap: 18, bold: true },
    { text: 'The Contractor agrees to carry out the work set out in the schedule attached to this', size: 11.5, gap: 16 },
    { text: 'agreement, and to deliver it in full by the date both parties have agreed.', size: 11.5, gap: 26 },
    { text: '2. Fees and payment', size: 13, gap: 18, bold: true },
    { text: 'The Client agrees to pay .................... (........................................)', size: 11.5, gap: 16 },
    { text: 'within 15 days of accepting the completed work.', size: 11.5, gap: 26 },
    { text: '3. Termination', size: 13, gap: 18, bold: true },
    { text: 'Either party may end this agreement by giving the other at least 30 days\u2019 notice in writing.', size: 11.5, gap: 40 },
    { text: 'Both parties have read and understood this agreement, and sign below as a record of it.', size: 11.5, gap: 60 },
  ],
  signatures: [
    'Signed ................................ Client',
    'Signed ................................ Contractor',
  ],
  footer: 'Page 1 of 1 · A sample document for trying MeDF',
};

const SAMPLES = { th: TH, en: EN };

export async function createSampleDocument(
  fontLoader: FontLoader,
  locale: Locale = 'th',
): Promise<Uint8Array> {
  const sample = SAMPLES[locale] ?? TH;

  const pdf = await PDFDocument.create();
  const fonts = new FontBook(pdf, fontLoader);
  // Sarabun for both: it covers Latin as well, so one embedded font serves
  // either language and the file stays small.
  const regular = await fonts.load({ family: 'sarabun', bold: false, italic: false });
  const bold = await fonts.load({ family: 'sarabun', bold: true, italic: false });

  const page = pdf.addPage([595.28, 841.89]); // A4
  const ink = rgb(0.08, 0.09, 0.19);
  const margin = 64;
  let y = 841.89 - 74;

  for (const line of sample.lines) {
    const font = line.bold ? bold : regular;
    const width = font.widthOfTextAtSize(line.text, line.size);
    // The title is centred; body copy is flush left.
    const x = line.size >= 20 ? (595.28 - width) / 2 : margin;
    page.drawText(line.text, { x, y, size: line.size, font, color: ink });
    y -= line.gap;
  }

  // Signature blocks, left blank on purpose: filling them in is the demo.
  for (const [index, label] of sample.signatures.entries()) {
    page.drawText(label, {
      x: index === 0 ? margin : 320,
      y: 150,
      size: 11.5,
      font: regular,
      color: ink,
    });
  }

  page.drawText(sample.footer, {
    x: margin,
    y: 48,
    size: 9,
    font: regular,
    color: rgb(0.55, 0.57, 0.66),
  });

  return pdf.save();
}
