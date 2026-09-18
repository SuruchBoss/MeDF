/**
 * A second MeDF process writing to the same data directory.
 *
 * `tests/file-lock.test.ts` spawns a few of these to prove the thing an
 * in-process mutex cannot: that concurrent read-modify-write cycles in
 * *separate* processes do not drop each other's records.
 *
 * Run as: node --import ../../scripts/register-ts-alias.mjs db-writer.mjs <label> <rounds>
 * with MEDF_DATA_DIR pointing at the shared directory.
 */
const [, , label, rounds] = process.argv;

const { flushDb, mutate } = await import('../../src/lib/db.ts');

for (let round = 0; round < Number(rounds); round += 1) {
  await mutate((db) => {
    db.usage.push({
      id: `${label}-${round}`,
      userId: label,
      kind: 'export',
      documentId: null,
      createdAt: new Date().toISOString(),
      period: '2026-09',
    });
  });
  // Let the others in, so the windows genuinely overlap rather than this
  // process holding the lock for its whole run.
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 12));
}

await flushDb();
