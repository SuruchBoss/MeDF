import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { promisify } from 'node:util';

/**
 * The lock exists for one reason: two MeDF processes sharing a data directory.
 * An in-process mutex cannot see the other one, so everything below that
 * matters is checked across a real process boundary.
 *
 * `DATA_DIR` is read when the module loads, so the temp directory has to be in
 * the environment before the import.
 */
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'medf-lock-test-'));
process.env.MEDF_DATA_DIR = dataDir;

const { tryFileLockSync, withFileLock } = await import('../src/lib/file-lock.ts');
const { flushDb, mutate, readDb } = await import('../src/lib/db.ts');

const run = promisify(execFile);
const webRoot = path.join(import.meta.dirname, '..');
const dbFile = path.join(dataDir, 'db.json');

after(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

/** Starts one of the second processes from `tests/fixtures/db-writer.mjs`. */
function spawnWriter(label: string, rounds: number): Promise<unknown> {
  return run(
    process.execPath,
    [
      '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
      '--import',
      path.join(webRoot, 'scripts', 'register-ts-alias.mjs'),
      path.join(webRoot, 'tests', 'fixtures', 'db-writer.mjs'),
      label,
      String(rounds),
    ],
    { cwd: webRoot, env: { ...process.env, MEDF_DATA_DIR: dataDir } },
  );
}

describe('withFileLock', () => {
  it('lets only one caller in at a time', async () => {
    const target = path.join(dataDir, 'exclusive');
    const order: string[] = [];

    async function critical(name: string) {
      await withFileLock(target, async () => {
        order.push(`${name}:in`);
        await new Promise((resolve) => setTimeout(resolve, 30));
        order.push(`${name}:out`);
      });
    }

    await Promise.all([critical('a'), critical('b')]);

    // Whoever went first, neither entered while the other was inside.
    assert.deepEqual(order.slice(0, 2).map((step) => step.split(':')[1]), ['in', 'out']);
  });

  it('releases the lock when the callback throws', async () => {
    const target = path.join(dataDir, 'throwing');
    await assert.rejects(
      withFileLock(target, async () => {
        throw new Error('boom');
      }),
      /boom/,
    );

    // A held lock would make this wait out the acquire timeout and fail.
    await withFileLock(target, async () => undefined);
  });

  it('takes over a lock left behind by a process that died', async () => {
    const target = path.join(dataDir, 'abandoned');
    const held = `${target}.lock`;
    await fs.mkdir(held);
    const longAgo = new Date(Date.now() - 60 * 60 * 1000);
    await fs.utimes(held, longAgo, longAgo);

    let entered = false;
    await withFileLock(target, async () => {
      entered = true;
    });
    assert.ok(entered, 'a stale lock must not block the machine forever');
  });

  it('refuses to take over a lock that is being held right now', async () => {
    const target = path.join(dataDir, 'contended');
    const held = `${target}.lock`;
    await fs.mkdir(held);
    try {
      // The acquire timeout is ten seconds, so this only checks that it waits
      // rather than barging in; a second is plenty to tell the two apart.
      const barged = await Promise.race([
        withFileLock(target, async () => 'barged').catch(() => 'failed'),
        new Promise((resolve) => setTimeout(() => resolve('waited'), 1000)),
      ]);
      assert.equal(barged, 'waited');
    } finally {
      await fs.rm(held, { recursive: true, force: true });
    }
  });
});

describe('tryFileLockSync', () => {
  it('reports failure rather than throwing when the lock is held', async () => {
    const target = path.join(dataDir, 'sync');
    await fs.mkdir(`${target}.lock`);
    const lock = tryFileLockSync(target);
    assert.equal(lock.acquired, false);
    lock.release();
    // Releasing a lock it never took must not remove somebody else's.
    assert.ok(await fs.stat(`${target}.lock`));
    await fs.rm(`${target}.lock`, { recursive: true, force: true });

    const second = tryFileLockSync(target);
    assert.equal(second.acquired, true);
    second.release();
    await assert.rejects(fs.stat(`${target}.lock`));
  });
});

describe('two processes sharing a data directory', () => {
  it('loses no updates', async () => {
    const writers = 3;
    const rounds = 6;

    // This process joins in, and it is the interesting one: it holds a cache,
    // so it is the one that would write a stale copy over everybody else.
    const mine = (async () => {
      for (let round = 0; round < rounds; round += 1) {
        await mutate((db) => {
          db.usage.push({
            id: `parent-${round}`,
            userId: 'parent',
            kind: 'upload',
            documentId: null,
            createdAt: new Date().toISOString(),
            period: '2026-09',
          });
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      await flushDb();
    })();

    await Promise.all([
      mine,
      ...Array.from({ length: writers }, (_, index) => spawnWriter(`writer-${index}`, rounds)),
    ]);

    const onDisk = JSON.parse(await fs.readFile(dbFile, 'utf8')) as {
      usage: { id: string }[];
    };
    const ids = new Set(onDisk.usage.map((record) => record.id));

    assert.equal(
      ids.size,
      (writers + 1) * rounds,
      `expected every write to survive, found ${[...ids].sort().join(', ')}`,
    );
    for (let index = 0; index < writers; index += 1) {
      for (let round = 0; round < rounds; round += 1) {
        assert.ok(ids.has(`writer-${index}-${round}`), `writer-${index}-${round} was lost`);
      }
    }
  });

  it('serves another process’s writes to a reader that already has a cache', async () => {
    const before = (await readDb()).users.length;
    await spawnWriter('late', 1);

    const after = await readDb();
    assert.ok(
      after.usage.some((record) => record.id === 'late-0'),
      'the cache was served even though the file had moved on',
    );
    assert.equal(after.users.length, before);
  });
});
