import 'server-only';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './env';
import type { BillingInterval, PlanId, PlanStatus } from './plans';

/**
 * A tiny, dependency-free persistence layer.
 *
 * Members, document metadata and billing history live in a single JSON file
 * that is always written atomically (temp file + rename) behind an in-process
 * mutex. Large or frequently written payloads deliberately do *not* live here:
 * uploaded PDFs, images and per-document overlays are separate files under
 * `storage/`, so autosaving an overlay never rewrites the whole index.
 *
 * Everything below goes through `readDb()` / `mutate()`, which keeps the door
 * open for swapping in Postgres later without touching call sites.
 */

export interface UserRecord {
  id: string;
  email: string;
  /** Lower-cased e-mail, used for lookups and uniqueness. */
  emailKey: string;
  name: string;
  passwordHash: string;
  role: 'member' | 'admin';
  createdAt: string;
  lastLoginAt: string | null;
  /** Bumped on password change to invalidate existing session cookies. */
  sessionVersion: number;
  plan: PlanId;
  planStatus: PlanStatus;
  planInterval: BillingInterval | null;
  /** ISO date the current paid period ends, or null on the free plan. */
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export interface DocumentRecord {
  id: string;
  userId: string;
  title: string;
  originalFileName: string;
  /** File name inside `storage/pdf/`. */
  fileKey: string;
  sizeBytes: number;
  pageCount: number;
  createdAt: string;
  updatedAt: string;
  /** Incremented on every overlay save; used for optimistic concurrency. */
  revision: number;
  elementCount: number;
}

export interface AssetRecord {
  id: string;
  userId: string;
  documentId: string | null;
  fileKey: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  createdAt: string;
}

export interface InvoiceRecord {
  id: string;
  userId: string;
  plan: PlanId;
  interval: BillingInterval;
  amount: number;
  currency: 'THB';
  status: 'paid' | 'open' | 'void';
  provider: 'stripe' | 'sandbox';
  reference: string | null;
  createdAt: string;
}

export interface UsageRecord {
  id: string;
  userId: string;
  kind: 'upload' | 'export';
  documentId: string | null;
  createdAt: string;
  /** `YYYY-MM`, so monthly quotas are a cheap prefix match. */
  period: string;
}

export interface Database {
  schemaVersion: number;
  users: UserRecord[];
  documents: DocumentRecord[];
  assets: AssetRecord[];
  invoices: InvoiceRecord[];
  usage: UsageRecord[];
}

export const SCHEMA_VERSION = 1;

const DB_FILE = path.join(DATA_DIR, 'db.json');

export const STORAGE_DIRS = {
  pdf: path.join(DATA_DIR, 'storage', 'pdf'),
  assets: path.join(DATA_DIR, 'storage', 'assets'),
  overlays: path.join(DATA_DIR, 'storage', 'overlays'),
} as const;

function emptyDatabase(): Database {
  return {
    schemaVersion: SCHEMA_VERSION,
    users: [],
    documents: [],
    assets: [],
    invoices: [],
    usage: [],
  };
}

interface DbState {
  cache: Database | null;
  queue: Promise<unknown>;
  ready: Promise<void> | null;
}

// Survive hot reloads in development so the mutex and cache stay single.
const globalState = globalThis as typeof globalThis & { __medfDb?: DbState };
const state: DbState = (globalState.__medfDb ??= { cache: null, queue: Promise.resolve(), ready: null });

async function ensureDirs(): Promise<void> {
  state.ready ??= (async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await Promise.all(Object.values(STORAGE_DIRS).map((dir) => fs.mkdir(dir, { recursive: true })));
  })();
  await state.ready;
}

/** Applies forward migrations to a database read from disk. */
function migrate(db: Database): Database {
  const next: Database = { ...emptyDatabase(), ...db };
  next.schemaVersion = SCHEMA_VERSION;
  return next;
}

async function loadFromDisk(): Promise<Database> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    return migrate(JSON.parse(raw) as Database);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      const fresh = emptyDatabase();
      await writeToDisk(fresh);
      return fresh;
    }
    if (error instanceof SyntaxError) {
      // Never silently discard member data: park the broken file and stop.
      const backup = `${DB_FILE}.corrupt-${Date.now()}`;
      await fs.rename(DB_FILE, backup).catch(() => undefined);
      throw new Error(
        `ไม่สามารถอ่านฐานข้อมูลได้ (${DB_FILE}) ไฟล์เดิมถูกสำรองไว้ที่ ${backup}`,
      );
    }
    throw error;
  }
}

async function writeToDisk(db: Database): Promise<void> {
  await ensureDirs();
  const tmp = `${DB_FILE}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
  await fs.rename(tmp, DB_FILE);
}

/** Read-only snapshot. Callers must not mutate the result. */
export async function readDb(): Promise<Database> {
  state.cache ??= await loadFromDisk();
  return state.cache;
}

/**
 * Runs `fn` against the database with exclusive access and persists the result.
 * Writes are serialised through a promise chain, so concurrent requests cannot
 * interleave a read-modify-write cycle.
 */
export async function mutate<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
  const run = state.queue.then(async () => {
    const db = await readDb();
    // Work on a copy so a thrown callback cannot leave the cache half-updated.
    const draft: Database = {
      ...db,
      users: [...db.users],
      documents: [...db.documents],
      assets: [...db.assets],
      invoices: [...db.invoices],
      usage: [...db.usage],
    };
    const result = await fn(draft);
    await writeToDisk(draft);
    state.cache = draft;
    return result;
  });
  // Keep the chain alive even when a caller's callback rejects.
  state.queue = run.catch(() => undefined);
  return run;
}

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function currentPeriod(date: Date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
