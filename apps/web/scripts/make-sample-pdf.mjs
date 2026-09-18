// Builds the fixture PDF used by the smoke test: three pages with distinct
// text, one of them carrying an intrinsic /Rotate 90 so the export maths is
// exercised for rotated pages too.
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';

export async function makeSamplePdf() {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const labels = ['PAGEMARKER-ONE', 'PAGEMARKER-TWO', 'PAGEMARKER-THREE'];

  labels.forEach((label, index) => {
    const page = pdf.addPage([595.28, 841.89]); // A4
    page.drawText(label, { x: 60, y: 760, size: 22, font, color: rgb(0.1, 0.1, 0.4) });
    page.drawRectangle({
      x: 50,
      y: 60,
      width: 495,
      height: 660,
      borderColor: rgb(0.8, 0.8, 0.85),
      borderWidth: 1,
    });
    if (index === 1) page.setRotation(degrees(90));
  });

  return pdf.save();
}

if (process.argv[1]?.endsWith('make-sample-pdf.mjs')) {
  const bytes = await makeSamplePdf();
  const { writeFile } = await import('node:fs/promises');
  await writeFile(process.argv[2] ?? 'sample.pdf', bytes);
  console.log(`wrote ${process.argv[2] ?? 'sample.pdf'} (${bytes.byteLength} bytes)`);
}
