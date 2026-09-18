import { PDFDocument } from 'pdf-lib';
import type { PageState } from '../editor-types';
import { displaySize, normalizeRotation } from './matrix';

/**
 * Reads the page boxes of a PDF into the editor's page model.
 *
 * Isomorphic: the upload route uses it on the server, the browser-only demo
 * uses it on the client, so both agree on what a page's size is.
 */

export class PdfGeometryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfGeometryError';
  }
}

export async function readPageGeometry(bytes: Uint8Array): Promise<PageState[]> {
  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch (error) {
    throw new PdfGeometryError(
      `ไม่สามารถอ่านไฟล์ PDF นี้ได้ (${(error as Error).message}) หากไฟล์ตั้งรหัสผ่านไว้ กรุณาปลดรหัสก่อน`,
    );
  }

  if (pdf.isEncrypted) {
    throw new PdfGeometryError('ไฟล์ PDF นี้ถูกเข้ารหัสไว้ กรุณาปลดรหัสผ่านก่อน');
  }

  const pages = pdf.getPages();
  if (pages.length === 0) throw new PdfGeometryError('ไฟล์ PDF ไม่มีหน้าเลย');

  return pages.map((page, index) => {
    const box = (() => {
      try {
        return page.getCropBox();
      } catch {
        return page.getMediaBox();
      }
    })();
    // The editor stores geometry in the page's *base display* space, i.e. with
    // the file's own /Rotate already applied.
    const rotation = normalizeRotation(page.getRotation().angle);
    const size = displaySize(box.width, box.height, rotation);
    return {
      source: index,
      rotation: 0 as const,
      hidden: false,
      width: Math.round(size.width * 100) / 100,
      height: Math.round(size.height * 100) / 100,
    } satisfies PageState;
  });
}
