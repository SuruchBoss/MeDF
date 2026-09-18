import 'server-only';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * A lock two processes on one machine can agree on.
 *
 * `mkdir` is the primitive: on every platform this app targets it either
 * creates the directory or fails with `EEXIST`, with no window in between.
 * That is enough to serialise a read-modify-write of a file, which is what the
 * datastore needs and what an in-process mutex alone cannot give — a second
 * `next start` on the same data directory, a desktop app left running, or a
 * maintenance script would each have their own mutex and neither would see
 * the other.
 *
 * This is a *machine* lock, not a cluster lock. Running MeDF on more than one
 * host needs a shared datastore; see docs/ARCHITECTURE.md.
 */

/** A lock older than this belonged to a process that died. */
const STALE_MS = 30_000;

/** How long to keep trying before giving up rather than corrupting anything. */
const ACQUIRE_TIMEOUT_MS = 10_000;

const RETRY_MS = 15;

function lockPath(target: string): string {
  return `${target}.lock`;
}

/** Ownership details, for a human reading a lock that would not clear. */
function owner(): string {
  return JSON.stringify({ pid: process.pid, at: new Date().toISOString() });
}

async function isStale(dir: string): Promise<boolean> {
  try {
    const stats = await fs.stat(dir);
    return Date.now() - stats.mtimeMs > STALE_MS;
  } catch {
    // It vanished between the failed mkdir and now, which is the good case.
    return true;
  }
}

/**
 * Runs `fn` with an exclusive lock on `target`.
 *
 * The lock is always released, including when `fn` throws — otherwise one
 * failed request would block every later one until the staleness timeout.
 */
export async function withFileLock<T>(target: string, fn: () => Promise<T>): Promise<T> {
  const dir = lockPath(target);
  const deadline = Date.now() + ACQUIRE_TIMEOUT_MS;

  for (;;) {
    try {
      await fs.mkdir(dir);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (await isStale(dir)) {
        // Take it over. A racing process may remove it first, which is fine.
        await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
        continue;
      }
      if (Date.now() > deadline) {
        throw new Error(
          `Timed out waiting for the lock at ${dir}. If no other MeDF process is running, remove it.`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
    }
  }

  await fs.writeFile(path.join(dir, 'owner'), owner(), 'utf8').catch(() => undefined);
  try {
    return await fn();
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * The same lock, without awaiting — for `process.on('exit')`, which cannot.
 *
 * Returns whether it was acquired. The caller writes either way: the write
 * itself is atomic (temp file plus rename), so the worst case of writing
 * unlocked is a lost update, and the alternative is losing the data outright.
 */
export function tryFileLockSync(target: string): { release: () => void; acquired: boolean } {
  const dir = lockPath(target);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      fsSync.mkdirSync(dir);
      return {
        acquired: true,
        release: () => {
          try {
            fsSync.rmSync(dir, { recursive: true, force: true });
          } catch {
            /* nothing useful to do while exiting */
          }
        },
      };
    } catch {
      /* held; try again or give up */
    }
  }
  return { acquired: false, release: () => undefined };
}
