import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import { STORAGE_DIRS } from './db';

/**
 * File storage for uploaded PDFs, images and per-document overlay JSON.
 * Keys are generated here and validated on every read, so a crafted key can
 * never escape the storage directory.
 */

export type StorageBucket = keyof typeof STORAGE_DIRS;

const SAFE_KEY = /^[A-Za-z0-9._-]{1,120}$/;

function resolveKey(bucket: StorageBucket, key: string): string {
  if (!SAFE_KEY.test(key) || key.includes('..')) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  const dir = STORAGE_DIRS[bucket];
  const full = path.join(dir, key);
  if (path.relative(dir, full).startsWith('..')) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  return full;
}

async function ensureBucket(bucket: StorageBucket): Promise<void> {
  await fs.mkdir(STORAGE_DIRS[bucket], { recursive: true });
}

export async function writeFileTo(
  bucket: StorageBucket,
  key: string,
  data: Uint8Array | string,
): Promise<void> {
  await ensureBucket(bucket);
  const target = resolveKey(bucket, key);
  const tmp = `${target}.tmp`;
  await fs.writeFile(tmp, data);
  await fs.rename(tmp, target);
}

export async function readFileFrom(bucket: StorageBucket, key: string): Promise<Buffer> {
  return fs.readFile(resolveKey(bucket, key));
}

export async function readJsonFrom<T>(bucket: StorageBucket, key: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(resolveKey(bucket, key), 'utf8');
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function deleteFileFrom(bucket: StorageBucket, key: string): Promise<void> {
  try {
    await fs.unlink(resolveKey(bucket, key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

/** Builds a storage key from an id and an extension, e.g. `doc_123.pdf`. */
export function storageKey(id: string, extension: string): string {
  const ext = extension.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return `${id}.${ext || 'bin'}`;
}
