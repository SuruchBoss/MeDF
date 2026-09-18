import { PDFDocument } from 'pdf-lib';
import type { PageState } from '../editor-types';
import type { MessageKey, MessageParams } from '../i18n';
import { displaySize, normalizeRotation } from './matrix';

/**
 * Reads the page boxes of a PDF into the editor's page model.
 *
 * Isomorphic: the upload route uses it on the server, the browser-only demo
 * uses it on the client, so both agree on what a page's size is.
 */

/**
 * Carries a message key, not a sentence.
 *
 * This module runs on the server *and* in the browser-only demo, so it has no
 * translator of its own — whichever side catches this renders the key with the
 * locale it already knows.
 */
export class PdfGeometryError extends Error {
  readonly key: MessageKey;
  readonly params?: MessageParams;

  constructor(key: MessageKey, params?: MessageParams) {
    super(key);
    this.name = 'PdfGeometryError';
    this.key = key;
    this.params = params;
  }
}

export async function readPageGeometry(bytes: Uint8Array): Promise<PageState[]> {
  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch (error) {
    throw new PdfGeometryError('pdf.unreadable', { reason: (error as Error).message });
  }

  if (pdf.isEncrypted) {
    throw new PdfGeometryError('pdf.encrypted');
  }

  const pages = pdf.getPages();
  if (pages.length === 0) throw new PdfGeometryError('pdf.noPages');

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
