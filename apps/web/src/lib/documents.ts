import 'server-only';
import { PDFDocument } from 'pdf-lib';
import {
  type AssetRecord,
  type DocumentRecord,
  type UserRecord,
  mutate,
  newId,
  nowIso,
  readDb,
} from './db';
import { type OverlayDoc, type PageState, overlaySchema } from './editor-types';
import { displaySize, normalizeRotation } from './pdf/matrix';
import {
  deleteFileFrom,
  readFileFrom,
  readJsonFrom,
  storageKey,
  writeFileTo,
} from './storage';
import { assertCanCreateDocument, assertPageCountAllowed, recordUsage } from './quota';

export class DocumentError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'DocumentError';
  }
}

export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg'] as const;

function overlayKey(documentId: string): string {
  return storageKey(documentId, 'json');
}

/** Reads the page geometry of an uploaded PDF, in base display space. */
async function readPageGeometry(bytes: Uint8Array): Promise<PageState[]> {
  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  } catch (error) {
    throw new DocumentError(
      `ไม่สามารถอ่านไฟล์ PDF นี้ได้ (${(error as Error).message}) หากไฟล์ตั้งรหัสผ่านไว้ กรุณาปลดรหัสก่อนอัปโหลด`,
      422,
    );
  }

  if (pdf.isEncrypted) {
    throw new DocumentError('ไฟล์ PDF นี้ถูกเข้ารหัสไว้ กรุณาปลดรหัสผ่านก่อนอัปโหลด', 422);
  }

  const pages = pdf.getPages();
  if (pages.length === 0) throw new DocumentError('ไฟล์ PDF ไม่มีหน้าเลย', 422);

  return pages.map((page, index) => {
    const box = (() => {
      try {
        return page.getCropBox();
      } catch {
        return page.getMediaBox();
      }
    })();
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

export async function createDocument(options: {
  user: UserRecord;
  fileName: string;
  bytes: Uint8Array;
  title?: string;
}): Promise<DocumentRecord> {
  const { user, bytes } = options;
  await assertCanCreateDocument(user, bytes.byteLength);

  const pages = await readPageGeometry(bytes);
  assertPageCountAllowed(user, pages.length);

  const id = newId('doc');
  const fileKey = storageKey(id, 'pdf');
  await writeFileTo('pdf', fileKey, bytes);

  const overlay: OverlayDoc = { version: 1, pages, elements: [] };
  await writeFileTo('overlays', overlayKey(id), JSON.stringify(overlay));

  const cleanName = options.fileName.replace(/\.pdf$/i, '').trim() || 'เอกสารไม่มีชื่อ';
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
  if (!doc) throw new DocumentError('ไม่พบเอกสาร', 404);
  if (doc.userId !== userId) throw new DocumentError('ไม่มีสิทธิ์เข้าถึงเอกสารนี้', 403);
  return doc;
}

export async function readDocumentBytes(doc: DocumentRecord): Promise<Buffer> {
  try {
    return await readFileFrom('pdf', doc.fileKey);
  } catch {
    throw new DocumentError('ไฟล์ต้นฉบับหายไปจากพื้นที่จัดเก็บ', 410);
  }
}

export async function readOverlay(doc: DocumentRecord): Promise<OverlayDoc> {
  const raw = await readJsonFrom<unknown>('overlays', overlayKey(doc.id));
  if (!raw) {
    // Overlay missing (e.g. restored backup): rebuild it from the source PDF.
    const bytes = await readDocumentBytes(doc);
    const pages = await readPageGeometry(bytes);
    const overlay: OverlayDoc = { version: 1, pages, elements: [] };
    await writeFileTo('overlays', overlayKey(doc.id), JSON.stringify(overlay));
    return overlay;
  }
  const parsed = overlaySchema.safeParse(raw);
  if (!parsed.success) {
    throw new DocumentError('ข้อมูลการแก้ไขของเอกสารนี้เสียหาย', 422);
  }
  return parsed.data;
}

export async function saveOverlay(
  doc: DocumentRecord,
  overlay: OverlayDoc,
): Promise<DocumentRecord> {
  await writeFileTo('overlays', overlayKey(doc.id), JSON.stringify(overlay));
  return mutate((db) => {
    const target = db.documents.find((candidate) => candidate.id === doc.id);
    if (!target) throw new DocumentError('ไม่พบเอกสาร', 404);
    target.updatedAt = nowIso();
    target.revision += 1;
    target.elementCount = overlay.elements.length;
    target.pageCount = overlay.pages.filter((page) => !page.hidden).length;
    return target;
  });
}

export async function renameDocument(doc: DocumentRecord, title: string): Promise<DocumentRecord> {
  const clean = title.trim().slice(0, 120);
  if (!clean) throw new DocumentError('ชื่อเอกสารว่างไม่ได้');
  return mutate((db) => {
    const target = db.documents.find((candidate) => candidate.id === doc.id);
    if (!target) throw new DocumentError('ไม่พบเอกสาร', 404);
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

  await Promise.all([
    deleteFileFrom('pdf', doc.fileKey),
    deleteFileFrom('overlays', overlayKey(doc.id)),
    ...assets.map((asset) => deleteFileFrom('assets', asset.fileKey)),
  ]);
}

export async function duplicateDocument(
  user: UserRecord,
  doc: DocumentRecord,
): Promise<DocumentRecord> {
  await assertCanCreateDocument(user, doc.sizeBytes);
  const bytes = await readDocumentBytes(doc);
  const overlay = await readOverlay(doc);

  const id = newId('doc');
  const fileKey = storageKey(id, 'pdf');
  await writeFileTo('pdf', fileKey, bytes);
  await writeFileTo('overlays', overlayKey(id), JSON.stringify(overlay));

  const copy: DocumentRecord = {
    ...doc,
    id,
    fileKey,
    title: `${doc.title} (สำเนา)`.slice(0, 120),
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
    const assetKey = storageKey(assetId, asset.mimeType === 'image/png' ? 'png' : 'jpg');
    await writeFileTo('assets', assetKey, await readFileFrom('assets', asset.fileKey));
    clones.push({ ...asset, id: assetId, documentId: id, fileKey: assetKey, createdAt: nowIso() });
  }

  if (clones.length > 0) {
    const remap = new Map(assets.map((asset, index) => [asset.id, clones[index].id]));
    overlay.elements = overlay.elements.map((element) =>
      element.type === 'image' && remap.has(element.assetId)
        ? { ...element, assetId: remap.get(element.assetId)! }
        : element,
    );
    await writeFileTo('overlays', overlayKey(id), JSON.stringify(overlay));
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
    throw new DocumentError('รองรับเฉพาะไฟล์ PNG และ JPEG', 415);
  }
  const maxBytes = 20 * 1024 * 1024;
  if (bytes.byteLength > maxBytes) {
    throw new DocumentError('ไฟล์รูปภาพต้องไม่เกิน 20 MB', 413);
  }

  const id = newId('ast');
  const fileKey = storageKey(id, mimeType === 'image/png' ? 'png' : 'jpg');
  await writeFileTo('assets', fileKey, bytes);

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
  if (!asset) throw new DocumentError('ไม่พบรูปภาพ', 404);
  if (asset.userId !== userId) throw new DocumentError('ไม่มีสิทธิ์เข้าถึงรูปภาพนี้', 403);
  return asset;
}

export async function readAssetBytes(asset: AssetRecord): Promise<Buffer> {
  return readFileFrom('assets', asset.fileKey);
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
  await Promise.all(orphans.map((asset) => deleteFileFrom('assets', asset.fileKey)));
  return orphans.length;
}
