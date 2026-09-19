'use client';

/**
 * Where a member's work lives now that there is no server.
 *
 * IndexedDB, wrapped by hand rather than through a library: the four stores
 * below and about a dozen operations are the whole surface, and a wrapper is
 * cheaper than a dependency the bundle has to carry to every visitor.
 *
 * Two rules run through everything here.
 *
 * **Every call can fail, and none of them may take the page down.** Safari in
 * private mode refuses IndexedDB outright, a browser can be out of quota, and
 * a database can be blocked by another tab mid-upgrade. Each entry point
 * therefore resolves to a value the caller can act on rather than throwing,
 * and `isAvailable()` answers the question up front so the UI can say so
 * plainly instead of failing at the first save.
 *
 * **Blobs go in as Blobs.** Storing a PDF as a base64 string would inflate it
 * by a third and force it through a string copy on every read; IndexedDB
 * stores binary natively.
 */

import type { OverlayDoc } from '@/lib/editor-types';

const DB_NAME = 'medf';
const DB_VERSION = 1;

/** Metadata only — the bytes live in their own stores, keyed by the same id. */
const DOCUMENTS = 'documents';
/** `id` → the original PDF, untouched for the life of the document. */
const FILES = 'files';
/** `id` → the overlay JSON. Separate because it is rewritten constantly. */
const OVERLAYS = 'overlays';
/** `assetId` → an image placed in a document. */
const ASSETS = 'assets';

export interface StoredDocument {
  id: string;
  title: string;
  pageCount: number;
  /** Size of the source PDF, for the usage figure. */
  sizeBytes: number;
  createdAt: number;
  updatedAt: number;
  /** Bumped on every overlay save; the editor uses it for optimistic saves. */
  revision: number;
  elementCount: number;
}

export interface StoredAsset {
  assetId: string;
  documentId: string;
  blob: Blob;
  width: number;
  height: number;
}

/** What went wrong, in terms the UI can translate. */
export type StoreFailure = 'unavailable' | 'quota' | 'unknown';

export class LocalStoreError extends Error {
  readonly reason: StoreFailure;

  constructor(reason: StoreFailure, cause?: unknown) {
    super(`local store: ${reason}`);
    this.name = 'LocalStoreError';
    this.reason = reason;
    this.cause = cause;
  }
}

/** A quota failure is reported under three different names across browsers. */
function classify(error: unknown): StoreFailure {
  const name = (error as { name?: string } | null)?.name;
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return 'quota';
  // Safari's private mode rejects `open()` outright rather than on write.
  if (name === 'SecurityError' || name === 'InvalidStateError') return 'unavailable';
  return 'unknown';
}

let opening: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new LocalStoreError('unavailable'));
      return;
    }
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(new LocalStoreError(classify(error), error));
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DOCUMENTS)) {
        db.createObjectStore(DOCUMENTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES);
      if (!db.objectStoreNames.contains(OVERLAYS)) db.createObjectStore(OVERLAYS);
      if (!db.objectStoreNames.contains(ASSETS)) {
        const assets = db.createObjectStore(ASSETS, { keyPath: 'assetId' });
        // Deleting a document deletes its images; without this that would be
        // a full scan of every asset ever stored.
        assets.createIndex('documentId', 'documentId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new LocalStoreError(classify(request.error), request.error));
    // Another tab is holding the old version open during an upgrade.
    request.onblocked = () => reject(new LocalStoreError('unavailable'));
  }).catch((error: unknown) => {
    // Never cache a failure: the next attempt may be in a different tab state.
    opening = null;
    throw error;
  });

  return opening;
}

/** Runs `work` in one transaction and resolves when the transaction commits. */
async function transact<T>(
  stores: string[],
  mode: IDBTransactionMode,
  work: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(stores, mode);
    } catch (error) {
      reject(new LocalStoreError(classify(error), error));
      return;
    }

    let result: T;
    // Resolve on `complete`, not on the last request: a write is not durable
    // until the transaction commits, and it can still fail on quota there.
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(new LocalStoreError(classify(tx.error), tx.error));
    tx.onabort = () => reject(new LocalStoreError(classify(tx.error), tx.error));

    Promise.resolve(work(tx)).then(
      (value) => {
        result = value;
      },
      (error: unknown) => {
        try {
          tx.abort();
        } catch {
          /* already finished */
        }
        reject(error instanceof LocalStoreError ? error : new LocalStoreError(classify(error), error));
      },
    );
  });
}

function request<T>(source: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    source.onsuccess = () => resolve(source.result);
    source.onerror = () => reject(new LocalStoreError(classify(source.error), source.error));
  });
}

/**
 * Whether this browser will store anything at all.
 *
 * Asked once before the UI promises to keep the member's work, so a private
 * window gets an honest warning instead of a save that silently does nothing.
 */
export async function isAvailable(): Promise<boolean> {
  try {
    await openDb();
    return true;
  } catch {
    return false;
  }
}

export function newDocumentId(): string {
  return `doc_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

export function newAssetId(): string {
  return `ast_${crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

export async function listDocuments(): Promise<StoredDocument[]> {
  const rows = await transact([DOCUMENTS], 'readonly', (tx) =>
    request(tx.objectStore(DOCUMENTS).getAll() as IDBRequest<StoredDocument[]>),
  );
  return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function readDocument(id: string): Promise<StoredDocument | null> {
  const row = await transact([DOCUMENTS], 'readonly', (tx) =>
    request(tx.objectStore(DOCUMENTS).get(id) as IDBRequest<StoredDocument | undefined>),
  );
  return row ?? null;
}

export async function readSource(id: string): Promise<Blob | null> {
  const blob = await transact([FILES], 'readonly', (tx) =>
    request(tx.objectStore(FILES).get(id) as IDBRequest<Blob | undefined>),
  );
  return blob ?? null;
}

export async function readOverlay(id: string): Promise<OverlayDoc | null> {
  const overlay = await transact([OVERLAYS], 'readonly', (tx) =>
    request(tx.objectStore(OVERLAYS).get(id) as IDBRequest<OverlayDoc | undefined>),
  );
  return overlay ?? null;
}

/** Writes the document, its source PDF and its first overlay in one go. */
export async function createDocument(input: {
  title: string;
  source: Blob;
  overlay: OverlayDoc;
  pageCount: number;
}): Promise<StoredDocument> {
  const now = Date.now();
  const record: StoredDocument = {
    id: newDocumentId(),
    title: input.title,
    pageCount: input.pageCount,
    sizeBytes: input.source.size,
    createdAt: now,
    updatedAt: now,
    revision: 1,
    elementCount: input.overlay.elements.length,
  };

  await transact([DOCUMENTS, FILES, OVERLAYS], 'readwrite', (tx) => {
    tx.objectStore(DOCUMENTS).put(record);
    tx.objectStore(FILES).put(input.source, record.id);
    tx.objectStore(OVERLAYS).put(input.overlay, record.id);
  });
  return record;
}

export async function saveOverlay(
  id: string,
  overlay: OverlayDoc,
): Promise<{ revision: number }> {
  return transact([DOCUMENTS, OVERLAYS], 'readwrite', async (tx) => {
    const documents = tx.objectStore(DOCUMENTS);
    const existing = await request(documents.get(id) as IDBRequest<StoredDocument | undefined>);
    if (!existing) throw new LocalStoreError('unknown');

    const next: StoredDocument = {
      ...existing,
      revision: existing.revision + 1,
      updatedAt: Date.now(),
      elementCount: overlay.elements.length,
      pageCount: overlay.pages.filter((page) => !page.hidden).length,
    };
    documents.put(next);
    tx.objectStore(OVERLAYS).put(overlay, id);
    return { revision: next.revision };
  });
}

export async function renameDocument(id: string, title: string): Promise<{ revision: number }> {
  return transact([DOCUMENTS], 'readwrite', async (tx) => {
    const documents = tx.objectStore(DOCUMENTS);
    const existing = await request(documents.get(id) as IDBRequest<StoredDocument | undefined>);
    if (!existing) throw new LocalStoreError('unknown');
    const next = { ...existing, title, revision: existing.revision + 1, updatedAt: Date.now() };
    documents.put(next);
    return { revision: next.revision };
  });
}

export async function deleteDocument(id: string): Promise<void> {
  await transact([DOCUMENTS, FILES, OVERLAYS, ASSETS], 'readwrite', async (tx) => {
    tx.objectStore(DOCUMENTS).delete(id);
    tx.objectStore(FILES).delete(id);
    tx.objectStore(OVERLAYS).delete(id);

    // Images belong to their document; leaving them behind would be storage
    // nobody can see, reach or free.
    const index = tx.objectStore(ASSETS).index('documentId');
    const keys = await request(index.getAllKeys(id) as IDBRequest<IDBValidKey[]>);
    for (const key of keys) tx.objectStore(ASSETS).delete(key);
  });
}

export async function putAsset(asset: StoredAsset): Promise<void> {
  await transact([ASSETS], 'readwrite', (tx) => {
    tx.objectStore(ASSETS).put(asset);
  });
}

export async function readAssets(documentId: string): Promise<StoredAsset[]> {
  return transact([ASSETS], 'readonly', (tx) =>
    request(
      tx.objectStore(ASSETS).index('documentId').getAll(documentId) as IDBRequest<StoredAsset[]>,
    ),
  );
}

/**
 * Roughly how much room the member's work is taking, and how much there is.
 *
 * `navigator.storage.estimate()` is the only figure a browser will give, it
 * counts everything this origin stores, and it is deliberately fuzzy. Good
 * enough to warn someone before they hit the wall; not a number to do
 * arithmetic on.
 */
export async function estimateUsage(): Promise<{ usedBytes: number; quotaBytes: number } | null> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (!estimate || estimate.usage == null || estimate.quota == null) return null;
    return { usedBytes: estimate.usage, quotaBytes: estimate.quota };
  } catch {
    return null;
  }
}
