import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

/**
 * `DATA_DIR` is read once, when the module loads, so the temp directory has to
 * be in the environment before the import. `node --test` gives each file its
 * own process, so this cannot affect the other suites.
 */
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'medf-db-test-'));
process.env.MEDF_DATA_DIR = dataDir;

const { flushDb, mutate, readDb } = await import('../src/lib/db.ts');
const dbFile = path.join(dataDir, 'db.json');

/** What is actually on disk right now, as opposed to what the cache holds. */
async function onDisk(): Promise<{ users: { name: string }[] }> {
  return JSON.parse(await fs.readFile(dbFile, 'utf8'));
}

function user(name: string) {
  return {
    id: name,
    email: `${name}@example.com`,
    emailKey: `${name}@example.com`,
    name,
    passwordHash: 'x',
    role: 'member' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastLoginAt: null,
    sessionVersion: 1,
    plan: 'free' as const,
    planStatus: 'active' as const,
    planInterval: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  };
}

before(async () => {
  await mutate((db) => {
    db.users = [user('start')];
  });
});

after(async () => {
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe('mutate (durable, the default)', () => {
  it('is on disk by the time it resolves', async () => {
    await mutate((db) => {
      db.users = [user('durable')];
    });
    assert.equal((await onDisk()).users[0].name, 'durable');
  });

  it('serialises concurrent read-modify-write cycles', async () => {
    await mutate((db) => {
      db.users = [];
    });
    await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        mutate((db) => {
          db.users = [...db.users, user(`u${index}`)];
        }),
      ),
    );
    assert.equal((await readDb()).users.length, 25, 'no update may be lost');
    assert.equal((await onDisk()).users.length, 25);
  });
});

describe('mutate with durable: false', () => {
  it('is readable at once but not yet written', async () => {
    await mutate((db) => {
      db.users = [user('flushed')];
    });

    await mutate(
      (db) => {
        db.users = [user('deferred')];
      },
      { durable: false },
    );

    assert.equal((await readDb()).users[0].name, 'deferred', 'the caller reads its own write');
    assert.equal((await onDisk()).users[0].name, 'flushed', 'disk still holds the last durable write');

    await flushDb();
    assert.equal((await onDisk()).users[0].name, 'deferred');
  });

  it('coalesces a burst into a single write', async () => {
    await mutate((db) => {
      db.users = [user('before-burst')];
    });

    // What an editor autosaving does: many small metadata bumps in a row.
    for (let index = 0; index < 50; index += 1) {
      await mutate(
        (db) => {
          db.users = [user(`burst-${index}`)];
        },
        { durable: false },
      );
    }

    assert.equal(
      (await onDisk()).users[0].name,
      'before-burst',
      '50 deferred writes must not have touched the file yet',
    );
    await flushDb();
    assert.equal((await onDisk()).users[0].name, 'burst-49', 'the flush writes the latest state once');
  });

  it('is flushed by the next durable write', async () => {
    await mutate(
      (db) => {
        db.users = [user('pending'), user('extra')];
      },
      { durable: false },
    );
    await mutate((db) => {
      db.users = [db.users[0]];
    });
    assert.equal((await onDisk()).users.length, 1);
    assert.equal((await onDisk()).users[0].name, 'pending');
  });

  it('writes on its own within the throttle window', async () => {
    await mutate((db) => {
      db.users = [user('waiting')];
    });
    await mutate(
      (db) => {
        db.users = [user('throttled')];
      },
      { durable: false },
    );

    // Generous on purpose: the suite runs files concurrently and one of them
    // spawns real processes, so a tight window here would fail on load rather
    // than on a regression. A throttle that never fires still fails, just late.
    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline) {
      if ((await onDisk()).users[0]?.name === 'throttled') break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert.equal((await onDisk()).users[0].name, 'throttled', 'the throttle never fired');
  });
});

describe('a callback that throws', () => {
  it('does not leave its half-finished edit visible', async () => {
    await mutate((db) => {
      db.users = [user('intact')];
    });

    await assert.rejects(
      mutate((db) => {
        db.users[0].name = 'corrupted';
        throw new Error('เกิดข้อผิดพลาดกลางคัน');
      }),
      /กลางคัน/,
    );

    assert.equal((await readDb()).users[0].name, 'intact', 'the cache must not serve the half-edit');
    assert.equal((await onDisk()).users[0].name, 'intact');
  });

  it('leaves the mutex usable', async () => {
    await assert.rejects(mutate(() => { throw new Error('boom'); }));
    await mutate((db) => {
      db.users = [user('after-failure')];
    });
    assert.equal((await onDisk()).users[0].name, 'after-failure');
  });
});
