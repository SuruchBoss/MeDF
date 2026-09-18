import 'server-only';
import type { OverlayDoc } from './editor-types';
import {
  deleteFileFrom,
  readFileFrom,
  readJsonFrom,
  storageKey,
  writeFileTo,
} from './storage';

/**
 * Where a document's files live.
 *
 * A document is a database row *plus* three kinds of blob: the PDF that was
 * uploaded, the overlay JSON, and any images placed on it. Which bucket each
 * one goes in, and what its key looks like, used to be worked out again at
 * every call site in `documents.ts` — a dozen places that each had to know
 * `storageKey(id, 'pdf')` means the same file as `doc.fileKey`.
 *
 * That convention lives here now, so moving these blobs to object storage is a
 * change to this file and `storage.ts`, and nothing else.
 */

export function pdfKey(documentId: string): string {
  return storageKey(documentId, 'pdf');
}

export function overlayKey(documentId: string): string {
  return storageKey(documentId, 'json');
}

export function assetKey(assetId: string, mimeType: string): string {
  return storageKey(assetId, mimeType === 'image/png' ? 'png' : 'jpg');
}

export function writePdf(key: string, bytes: Uint8Array): Promise<void> {
  return writeFileTo('pdf', key, bytes);
}

export function readPdf(key: string): Promise<Buffer> {
  return readFileFrom('pdf', key);
}

export function writeOverlay(documentId: string, overlay: OverlayDoc): Promise<void> {
  return writeFileTo('overlays', overlayKey(documentId), JSON.stringify(overlay));
}

/** `null` when the document has no overlay yet, which is not an error. */
export function readOverlayJson(documentId: string): Promise<unknown> {
  return readJsonFrom<unknown>('overlays', overlayKey(documentId));
}

export function writeAsset(key: string, bytes: Uint8Array): Promise<void> {
  return writeFileTo('assets', key, bytes);
}

export function readAsset(key: string): Promise<Buffer> {
  return readFileFrom('assets', key);
}

export function deleteAsset(key: string): Promise<void> {
  return deleteFileFrom('assets', key);
}

/**
 * Removes everything belonging to one document.
 *
 * Deleting a blob that is already gone is not an error — a half-finished
 * upload can leave a row without its file, and the member still needs the
 * delete to succeed.
 */
export async function deleteDocumentFiles(
  documentId: string,
  fileKey: string,
  assetKeys: string[],
): Promise<void> {
  await Promise.all([
    deleteFileFrom('pdf', fileKey),
    deleteFileFrom('overlays', overlayKey(documentId)),
    ...assetKeys.map((key) => deleteFileFrom('assets', key)),
  ]);
}
