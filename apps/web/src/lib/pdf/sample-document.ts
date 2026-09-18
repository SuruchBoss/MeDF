import { PDFDocument, rgb } from 'pdf-lib';
import { FontBook, type FontLoader } from './fonts';

/**
 * Builds a small Thai document so a visitor can try the editor immediately,
 * without having to find a PDF of their own. Generated with pdf-lib, which the
 * app already ships, so it costs no extra download.
 */

const LINES: { text: string; size: number; gap: number; bold?: boolean }[] = [
  { text: 'สัญญาจ้างทำงาน', size: 20, gap: 34, bold: true },
  { text: 'ทำที่ กรุงเทพมหานคร', size: 12, gap: 20 },
  { text: 'วันที่ ......... เดือน ................... พ.ศ. ..........', size: 12, gap: 30 },
  {
    text: 'สัญญาฉบับนี้ทำขึ้นระหว่าง ................................................ ซึ่งต่อไปในสัญญานี้จะเรียกว่า “ผู้ว่าจ้าง” ฝ่ายหนึ่ง',
    size: 11.5,
    gap: 18,
  },
  {
    text: 'กับ ................................................ ซึ่งต่อไปในสัญญานี้จะเรียกว่า “ผู้รับจ้าง” อีกฝ่ายหนึ่ง',
    size: 11.5,
    gap: 26,
  },
  { text: 'ข้อ 1. ขอบเขตของงาน', size: 13, gap: 18, bold: true },
  {
    text: 'ผู้รับจ้างตกลงรับจ้างทำงานให้แก่ผู้ว่าจ้าง ตามรายละเอียดที่กำหนดไว้ในเอกสารแนบท้ายสัญญา',
    size: 11.5,
    gap: 16,
  },
  { text: 'โดยจะส่งมอบงานให้ครบถ้วนภายในกำหนดเวลาที่ทั้งสองฝ่ายได้ตกลงกันไว้', size: 11.5, gap: 26 },
  { text: 'ข้อ 2. ค่าจ้างและการชำระเงิน', size: 13, gap: 18, bold: true },
  {
    text: 'ผู้ว่าจ้างตกลงชำระค่าจ้างเป็นจำนวนเงิน .................... บาท (........................................)',
    size: 11.5,
    gap: 16,
  },
  { text: 'ภายใน 15 วันนับจากวันที่ผู้ว่าจ้างได้ตรวจรับงานเรียบร้อยแล้ว', size: 11.5, gap: 26 },
  { text: 'ข้อ 3. การเลิกสัญญา', size: 13, gap: 18, bold: true },
  {
    text: 'คู่สัญญาฝ่ายใดฝ่ายหนึ่งอาจบอกเลิกสัญญาได้ โดยแจ้งให้อีกฝ่ายทราบเป็นหนังสือล่วงหน้าไม่น้อยกว่า 30 วัน',
    size: 11.5,
    gap: 40,
  },
  {
    text: 'ทั้งสองฝ่ายได้อ่านและเข้าใจข้อความในสัญญานี้โดยละเอียดแล้ว จึงได้ลงลายมือชื่อไว้เป็นหลักฐาน',
    size: 11.5,
    gap: 60,
  },
];

export async function createSampleDocument(fontLoader: FontLoader): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fonts = new FontBook(pdf, fontLoader);
  const regular = await fonts.load({ family: 'sarabun', bold: false, italic: false });
  const bold = await fonts.load({ family: 'sarabun', bold: true, italic: false });

  const page = pdf.addPage([595.28, 841.89]); // A4
  const ink = rgb(0.08, 0.09, 0.19);
  const margin = 64;
  let y = 841.89 - 74;

  for (const line of LINES) {
    const font = line.bold ? bold : regular;
    const width = font.widthOfTextAtSize(line.text, line.size);
    // The title is centred; body copy is flush left.
    const x = line.size >= 20 ? (595.28 - width) / 2 : margin;
    page.drawText(line.text, { x, y, size: line.size, font, color: ink });
    y -= line.gap;
  }

  // Signature blocks, left blank on purpose: filling them in is the demo.
  for (const [index, label] of ['ลงชื่อ ................................ ผู้ว่าจ้าง', 'ลงชื่อ ................................ ผู้รับจ้าง'].entries()) {
    page.drawText(label, {
      x: index === 0 ? margin : 320,
      y: 150,
      size: 11.5,
      font: regular,
      color: ink,
    });
  }

  page.drawText('หน้า 1 / 1 · เอกสารตัวอย่างสำหรับทดลองใช้ MeDF', {
    x: margin,
    y: 48,
    size: 9,
    font: regular,
    color: rgb(0.55, 0.57, 0.66),
  });

  return pdf.save();
}
