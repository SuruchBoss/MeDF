import 'server-only';
import {
  type AssetRecord,
  type DocumentRecord,
  type UserRecord,
  mutate,
  newId,
  nowIso,
  readDb,
} from './db';
import { type OverlayDoc, overlaySchema } from './editor-types';
import { PdfGeometryError, readPageGeometry } from './pdf/page-geometry';
import {
  assetKey,
  deleteAsset,
  deleteDocumentFiles,
  pdfKey,
  readAsset,
  readOverlayJson,
  readPdf,
  writeAsset,
  writeOverlay,
  writePdf,
} from './document-files';
import { DocumentError } from './errors';
import { createTranslator, DEFAULT_LOCALE } from './i18n';
import { assertCanCreateDocument, assertPageCountAllowed, recordUsage } from './quota';

export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg'] as const;

/** Wraps the shared reader so callers get a status-carrying error. */
async function pageGeometryOrFail(bytes: Uint8Array) {
  try {
    return await readPageGeometry(bytes);
  } catch (error) {
    // The geometry reader already chose the right key; keep it and its detail.
    if (error instanceof PdfGeometryError) {
      throw new DocumentError(error.key, { status: 422, params: error.params });
    }
    throw error;
  }
}

export async function createDocument(options: {
  user: UserRecord;
  fileName: string;
  bytes: Uint8Array;
  title?: string;
}): Promise<DocumentRecord> {
  const { user, bytes } = options;
  await assertCanCreateDocument(user, bytes.byteLength);

  const pages = await pageGeometryOrFail(bytes);
  assertPageCountAllowed(user, pages.length);

  const id = newId('doc');
  const fileKey = pdfKey(id);
  await writePdf(fileKey, bytes);

  const overlay: OverlayDoc = { version: 1, pages, elements: [] };
  await writeOverlay(id, overlay);

  // A stored title is data, not a rendered string: it keeps whatever it was
  // named regardless of who opens it later, so the fallback uses the server's
  // default language rather than the caller's.
  const fallbackTitle = createTranslator(DEFAULT_LOCALE);
  const cleanName =
    options.fileName.replace(/\.pdf$/i, '').trim() || fallbackTitle('doc.untitled');
  const record: DocumentRecord = {
    id,
    userId: user.id,
    title: (options.title?.trim() || cleanName).slice(0, 120),
    originalFileName: options.fileName.slice(0, 200),
    fileKey,
    sizeBytes: bytes.byteLength,
    pageCount: pages.length,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    revision: 1,
    elementCount: 0,
  };

  await mutate((db) => {
    db.documents.push(record);
  });
  await recordUsage(user.id, 'upload', id);

  return record;
}

export async function listDocuments(userId: string): Promise<DocumentRecord[]> {
  const db = await readDb();
  return db.documents
    .filter((doc) => doc.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getDocument(userId: string, documentId: string): Promise<DocumentRecord> {
  const db = await readDb();
  const doc = db.documents.find((candidate) => candidate.id === documentId);
  if (!doc) throw new DocumentError('doc.error.notFound', { status: 404 });
  if (doc.userId !== userId) throw new DocumentError('doc.error.forbidden', { status: 403 });
  return doc;
}

export async function readDocumentBytes(doc: DocumentRecord): Promise<Buffer> {
  try {
    return await readPdf(doc.fileKey);
  } catch {
    throw new DocumentError('doc.error.fileMissing', { status: 410 });
  }
}

export async function readOverlay(doc: DocumentRecord): Promise<OverlayDoc> {
  const raw = await readOverlayJson(doc.id);
  if (!raw) {
    // Overlay missing (e.g. restored backup): rebuild it from the source PDF.
    const bytes = await readDocumentBytes(doc);
    const pages = await pageGeometryOrFail(bytes);
    const overlay: OverlayDoc = { version: 1, pages, elements: [] };
    await writeOverlay(doc.id, overlay);
    return overlay;
  }
  const parsed = overlaySchema.safeParse(raw);
  if (!parsed.success) {
    throw new DocumentError('doc.error.overlayCorrupt', { status: 422 });
  }
  return parsed.data;
}

export async function saveOverlay(
  doc: DocumentRecord,
  overlay: OverlayDoc,
): Promise<DocumentRecord> {
  await writeOverlay(doc.id, overlay);
  // The member's work is already on disk, above. What is left is the document
  // row's derived counters, which autosave touches every few seconds — so this
  // is the one write allowed to be deferred rather than rewriting the whole
  // index each time. See `MutateOptions.durable`.
  return mutate(
    (db) => {
      const target = db.documents.find((candidate) => candidate.id === doc.id);
      if (!target) throw new DocumentError('doc.error.notFound', { status: 404 });
      target.updatedAt = nowIso();
      target.revision += 1;
      target.elementCount = overlay.elements.length;
      target.pageCount = overlay.pages.filter((page) => !page.hidden).length;
      return target;
    },
    { durable: false },
  );
}

export async function renameDocument(doc: DocumentRecord, title: string): Promise<DocumentRecord> {
  const clean = title.trim().slice(0, 120);
  if (!clean) throw new DocumentError('doc.error.emptyTitle');
  return mutate((db) => {
    const target = db.documents.find((candidate) => candidate.id === doc.id);
    if (!target) throw new DocumentError('doc.error.notFound', { status: 404 });
    target.title = clean;
    target.updatedAt = nowIso();
    return target;
  });
}

export async function deleteDocument(doc: DocumentRecord): Promise<void> {
  const db = await readDb();
  const assets = db.assets.filter((asset) => asset.documentId === doc.id);

  await mutate((current) => {
    current.documents = current.documents.filter((candidate) => candidate.id !== doc.id);
    current.assets = current.assets.filter((asset) => asset.documentId !== doc.id);
  });

  await deleteDocumentFiles(
    doc.id,
    doc.fileKey,
    assets.map((asset) => asset.fileKey),
  );
}

export async function duplicateDocument(
  user: UserRecord,
  doc: DocumentRecord,
): Promise<DocumentRecord> {
  await assertCanCreateDocument(user, doc.sizeBytes);
  const bytes = await readDocumentBytes(doc);
  const overlay = await readOverlay(doc);

  const id = newId('doc');
  const fileKey = pdfKey(id);
  await writePdf(fileKey, bytes);
  await writeOverlay(id, overlay);

  const copy: DocumentRecord = {
    ...doc,
    id,
    fileKey,
    title: createTranslator(DEFAULT_LOCALE)('doc.copySuffix', { title: doc.title }).slice(0, 120),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    revision: 1,
    elementCount: overlay.elements.length,
  };

  // Image assets are shared by reference; re-point them at the new document.
  const db = await readDb();
  const assets = db.assets.filter((asset) => asset.documentId === doc.id);
  const clones: AssetRecord[] = [];
  for (const asset of assets) {
    const assetId = newId('ast');
    const copyKey = assetKey(assetId, asset.mimeType);
    await writeAsset(copyKey, await readAsset(asset.fileKey));
    clones.push({ ...asset, id: assetId, documentId: id, fileKey: copyKey, createdAt: nowIso() });
  }

  if (clones.length > 0) {
    const remap = new Map(assets.map((asset, index) => [asset.id, clones[index].id]));
    overlay.elements = overlay.elements.map((element) =>
      element.type === 'image' && remap.has(element.assetId)
        ? { ...element, assetId: remap.get(element.assetId)! }
        : element,
    );
    await writeOverlay(id, overlay);
  }

  await mutate((current) => {
    current.documents.push(copy);
    current.assets.push(...clones);
  });

  return copy;
}

// --- Image assets -----------------------------------------------------------

export async function createAsset(options: {
  user: UserRecord;
  documentId: string;
  bytes: Uint8Array;
  mimeType: string;
  width: number;
  height: number;
}): Promise<AssetRecord> {
  const { user, bytes, mimeType } = options;
  if (!IMAGE_MIME_TYPES.includes(mimeType as (typeof IMAGE_MIME_TYPES)[number])) {
    throw new DocumentError('doc.error.imageType', { status: 415 });
  }
  const maxBytes = 20 * 1024 * 1024;
  if (bytes.byteLength > maxBytes) {
    throw new DocumentError('doc.error.imageTooLarge', { status: 413 });
  }

  const id = newId('ast');
  const fileKey = assetKey(id, mimeType);
  await writeAsset(fileKey, bytes);

  const asset: AssetRecord = {
    id,
    userId: user.id,
    documentId: options.documentId,
    fileKey,
    mimeType,
    width: Math.max(1, Math.round(options.width)),
    height: Math.max(1, Math.round(options.height)),
    sizeBytes: bytes.byteLength,
    createdAt: nowIso(),
  };

  await mutate((db) => {
    db.assets.push(asset);
  });
  return asset;
}

export async function getAsset(userId: string, assetId: string): Promise<AssetRecord> {
  const db = await readDb();
  const asset = db.assets.find((candidate) => candidate.id === assetId);
  if (!asset) throw new DocumentError('doc.error.assetNotFound', { status: 404 });
  if (asset.userId !== userId) {
    throw new DocumentError('doc.error.assetForbidden', { status: 403 });
  }
  return asset;
}

export async function readAssetBytes(asset: AssetRecord): Promise<Buffer> {
  return readAsset(asset.fileKey);
}

/** Loader used by the export renderer, scoped to a single member. */
export function assetLoaderFor(userId: string) {
  return async (assetId: string) => {
    try {
      const asset = await getAsset(userId, assetId);
      return { bytes: await readAssetBytes(asset), mimeType: asset.mimeType };
    } catch {
      return null;
    }
  };
}

/** Removes asset files that no element references any more. */
export async function pruneUnusedAssets(doc: DocumentRecord, overlay: OverlayDoc): Promise<number> {
  const used = new Set(
    overlay.elements.filter((element) => element.type === 'image').map((element) => element.assetId),
  );
  const db = await readDb();
  const orphans = db.assets.filter((asset) => asset.documentId === doc.id && !used.has(asset.id));
  if (orphans.length === 0) return 0;

  await mutate((current) => {
    const orphanIds = new Set(orphans.map((asset) => asset.id));
    current.assets = current.assets.filter((asset) => !orphanIds.has(asset.id));
  });
  await Promise.all(orphans.map((asset) => deleteAsset(asset.fileKey)));
  return orphans.length;
}
