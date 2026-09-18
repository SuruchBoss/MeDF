import 'server-only';
import { randomUUID } from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './env';
import type { BillingInterval, PlanId, PlanStatus } from './plans';
import { ensureStorageDirs } from './storage';

/**
 * A tiny, dependency-free persistence layer.
 *
 * Members, document metadata and billing history live in a single JSON file
 * that is always written atomically (temp file + rename) behind an in-process
 * mutex. Large or frequently written payloads deliberately do *not* live here:
 * uploaded PDFs, images and per-document overlays are separate files under
 * `storage/`.
 *
 * A write rewrites the whole file, so the one caller that runs at editing
 * speed — the document row an overlay autosave touches — passes
 * `{ durable: false }` and rides a short throttle instead. Everything that
 * cannot be reconstructed is written before the call returns, as before.
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
  /** True when `cache` holds changes that are not on disk yet. */
  dirty: boolean;
  flushTimer: ReturnType<typeof setTimeout> | null;
  exitHooked: boolean;
}

// Survive hot reloads in development so the mutex and cache stay single.
const globalState = globalThis as typeof globalThis & { __medfDb?: DbState };
const state: DbState = (globalState.__medfDb ??= {
  cache: null,
  queue: Promise.resolve(),
  ready: null,
  dirty: false,
  flushTimer: null,
  exitHooked: false,
});

/**
 * How long a deferred write may sit in memory.
 *
 * This is a throttle, not a debounce: the first deferred change arms the timer
 * and everything within the window rides along on one file write, so a member
 * typing steadily still costs one write per window rather than one per save.
 */
const FLUSH_DELAY_MS = 750;

async function ensureDirs(): Promise<void> {
  state.ready ??= (async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await ensureStorageDirs();
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
        `Could not read the database (${DB_FILE}). The old file was kept at ${backup}.`,
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

/**
 * Writes the cache out synchronously on the way down.
 *
 * `process.on('exit')` cannot await, so this is the one place that blocks. It
 * only ever has deferred changes to write, which is at most one window's worth.
 */
function installExitHook(): void {
  if (state.exitHooked) return;
  state.exitHooked = true;
  process.on('exit', () => {
    if (!state.dirty || !state.cache) return;
    try {
      const tmp = `${DB_FILE}.${process.pid}.exit.tmp`;
      fsSync.writeFileSync(tmp, `${JSON.stringify(state.cache, null, 2)}\n`, 'utf8');
      fsSync.renameSync(tmp, DB_FILE);
      state.dirty = false;
    } catch {
      // There is nothing useful left to do while the process is exiting.
    }
  });
  // The loop can drain before the throttle fires; this catches that case with
  // a normal async write, and `exit` above remains the last resort.
  process.on('beforeExit', () => {
    void flushDb().catch(() => undefined);
  });
}

function scheduleFlush(): void {
  installExitHook();
  if (state.flushTimer) return;
  state.flushTimer = setTimeout(() => {
    state.flushTimer = null;
    void flushDb().catch(() => undefined);
  }, FLUSH_DELAY_MS);
  // Never keep the process alive just to write document metadata.
  state.flushTimer.unref?.();
}

/**
 * Writes any deferred changes out now. Joins the same queue as `mutate`, so it
 * can never interleave with a read-modify-write cycle.
 */
export async function flushDb(): Promise<void> {
  const run = state.queue.then(async () => {
    if (!state.dirty || !state.cache) return;
    await writeToDisk(state.cache);
    state.dirty = false;
  });
  state.queue = run.catch(() => undefined);
  await run;
}

/** Read-only snapshot. Callers must not mutate the result. */
export async function readDb(): Promise<Database> {
  state.cache ??= await loadFromDisk();
  return state.cache;
}

export interface MutateOptions {
  /**
   * `false` keeps the change in memory and writes it within `FLUSH_DELAY_MS`
   * instead of before returning.
   *
   * Only for a field that can be reconstructed from something already written
   * durably. Today that is the document row an overlay autosave touches: the
   * overlay file itself is written before `mutate` is called, so a process
   * killed inside the window loses a `revision` bump and an `updatedAt`, not a
   * member's work. Everything else — accounts, billing, quota — stays durable.
   */
  durable?: boolean;
}

/**
 * Runs `fn` against the database with exclusive access and persists the result.
 * Writes are serialised through a promise chain, so concurrent requests cannot
 * interleave a read-modify-write cycle.
 */
export async function mutate<T>(
  fn: (db: Database) => T | Promise<T>,
  options: MutateOptions = {},
): Promise<T> {
  const durable = options.durable ?? true;
  const run = state.queue.then(async () => {
    const db = await readDb();
    // A fresh list per collection, so adding or removing a record cannot be
    // seen half-done. The records themselves are shared, so a callback that
    // edits one in place and *then* throws would leave the cache ahead of
    // disk — hence the cache is dropped on the way out of a failed callback.
    const draft: Database = {
      ...db,
      users: [...db.users],
      documents: [...db.documents],
      assets: [...db.assets],
      invoices: [...db.invoices],
      usage: [...db.usage],
    };

    let result: T;
    try {
      result = await fn(draft);
    } catch (error) {
      state.cache = null;
      state.dirty = false;
      throw error;
    }

    state.cache = draft;
    if (durable) {
      await writeToDisk(draft);
      state.dirty = false;
    } else {
      state.dirty = true;
      scheduleFlush();
    }
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
