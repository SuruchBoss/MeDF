import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DATA_DIR } from './env';
import type { BillingInterval, PlanId, PlanStatus } from './plans';
import { tryFileLockSync, withFileLock } from './file-lock';
import { ensureStorageDirs } from './storage';

/**
 * A tiny, dependency-free persistence layer.
 *
 * Members, document metadata and billing history live in a single JSON file
 * that is always written atomically (temp file + rename). Large or frequently
 * written payloads deliberately do *not* live here: uploaded PDFs, images and
 * per-document overlays are separate files under `storage/`.
 *
 * Writes are guarded twice — a promise chain for callers inside this process,
 * a lock directory for other processes on the machine — so a second server, a
 * desktop build and a maintenance script can share one data directory without
 * losing each other's updates. What this does *not* buy is more than one host:
 * see docs/ARCHITECTURE.md.
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
  /**
   * Digest of the file as this process last read or wrote it, or `null` when
   * there was no file. Anything else on disk means somebody else wrote.
   */
  seen: string | null;
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
  seen: null,
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

/**
 * What the file says, as opposed to when it was touched.
 *
 * Modification time is the obvious way to notice another process's write and
 * the wrong one: two writes inside a single filesystem clock tick carry the
 * same timestamp, and "the file looks unchanged" is precisely the mistake that
 * drops somebody else's change. The content cannot lie.
 */
function digest(raw: string): string {
  return createHash('sha1').update(raw).digest('hex');
}

/** The file's text, or `null` when it has not been written yet. */
async function readRaw(): Promise<string | null> {
  try {
    return await fs.readFile(DB_FILE, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

/** Parses the file, parking a damaged one rather than writing over it. */
async function parseOrPark(raw: string): Promise<Database> {
  try {
    return migrate(JSON.parse(raw) as Database);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    // Never silently discard member data: park the broken file and stop.
    const backup = `${DB_FILE}.corrupt-${Date.now()}`;
    await fs.rename(DB_FILE, backup).catch(() => undefined);
    throw new Error(
      `Could not read the database (${DB_FILE}). The old file was kept at ${backup}.`,
    );
  }
}

/**
 * Brings the cache in line with the file, parsing only when it really changed.
 *
 * Deferred changes of our own are dropped when that happens. They are metadata
 * that `durable: false` already declares reconstructible, and the alternative —
 * writing our copy over theirs — loses a real change instead of a derived one.
 */
async function syncCache(): Promise<Database> {
  await ensureDirs();
  const raw = await readRaw();

  if (raw === null) {
    // Nothing on disk: a first run, or the file was removed under us. Our own
    // copy is then the better of the two, and the next write puts it back.
    state.seen = null;
    return (state.cache ??= emptyDatabase());
  }

  const stamp = digest(raw);
  if (state.cache !== null && stamp === state.seen) return state.cache;

  if (state.dirty) {
    console.warn('[medf] the data file changed underneath; deferred metadata was reloaded');
  }
  const db = await parseOrPark(raw);
  state.cache = db;
  state.seen = stamp;
  state.dirty = false;
  return db;
}

async function writeToDisk(db: Database): Promise<void> {
  await ensureDirs();
  const raw = `${JSON.stringify(db, null, 2)}\n`;
  const tmp = `${DB_FILE}.${process.pid}.${randomUUID()}.tmp`;
  await fs.writeFile(tmp, raw, 'utf8');
  await fs.rename(tmp, DB_FILE);
  state.seen = digest(raw);
}

/** True when the file no longer holds what this process last saw there. */
function changedUnderUs(): boolean {
  if (state.seen === null) return false;
  try {
    return digest(fsSync.readFileSync(DB_FILE, 'utf8')) !== state.seen;
  } catch {
    return false;
  }
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
    // Best effort: the write itself is atomic, so failing to take the lock
    // costs a lost update of deferred metadata, not a corrupt file.
    const lock = tryFileLockSync(DB_FILE);
    try {
      // Another process's change is real; ours is reconstructible metadata.
      if (changedUnderUs()) return;
      const tmp = `${DB_FILE}.${process.pid}.exit.tmp`;
      fsSync.writeFileSync(tmp, `${JSON.stringify(state.cache, null, 2)}\n`, 'utf8');
      fsSync.renameSync(tmp, DB_FILE);
      state.dirty = false;
    } catch {
      // There is nothing useful left to do while the process is exiting.
    } finally {
      lock.release();
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
    await ensureDirs();
    await withFileLock(DB_FILE, async () => {
      const db = await syncCache();
      // `syncCache` clears the flag when it pulls another process's write over
      // our deferred one; there is then nothing of ours left to write.
      if (!state.dirty) return;
      await writeToDisk(db);
      state.dirty = false;
    });
  });
  state.queue = run.catch(() => undefined);
  await run;
}

/**
 * Read-only snapshot. Callers must not mutate the result.
 *
 * The file is checked on every call, so a second process's writes are visible
 * here. The read is one small file; the parse only happens when the contents
 * actually moved.
 */
export async function readDb(): Promise<Database> {
  // Deferred changes of our own are ahead of the file. `flushDb` reconciles
  // them under the lock, so do not pull the file over them here.
  if (state.dirty && state.cache) return state.cache;
  return syncCache();
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
 *
 * Two locks, because there are two kinds of competitor. The promise chain
 * serialises callers inside this process; the lock directory serialises
 * processes on this machine. Neither alone is enough: an in-process mutex is
 * invisible to a second `next start`, and a file lock is a poor mutex for the
 * hundreds of overlapping requests one server handles.
 */
export async function mutate<T>(
  fn: (db: Database) => T | Promise<T>,
  options: MutateOptions = {},
): Promise<T> {
  const durable = options.durable ?? true;
  const run = state.queue.then(async () => {
    await ensureDirs();

    // Read, modify and write all happen inside the lock: reading outside it
    // would let another process write in between and lose one of the two.
    return withFileLock(DB_FILE, async () => {
      const db = await syncCache();

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
