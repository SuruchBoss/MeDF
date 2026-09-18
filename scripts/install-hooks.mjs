/**
 * Installs the repository's git hooks. Currently one pre-commit hook that runs
 * `guard-private.mjs`, so paid-tier files cannot be committed by accident.
 */
import { chmodSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const gitDir = (() => {
  try {
    return execFileSync('git', ['rev-parse', '--git-dir'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
})();

if (!gitDir || !existsSync(gitDir)) {
  console.error('[install-hooks] ไม่ใช่ git repository — ข้ามการติดตั้ง hook');
  process.exit(0);
}

const hooksDir = path.join(gitDir, 'hooks');
mkdirSync(hooksDir, { recursive: true });

const hookPath = path.join(hooksDir, 'pre-commit');
writeFileSync(
  hookPath,
  `#!/bin/sh
# ติดตั้งโดย npm run setup:hooks — กันโค้ดฟีเจอร์แบบชำระเงินหลุดเข้า repo สาธารณะ
exec node "$(git rev-parse --show-toplevel)/scripts/guard-private.mjs"
`,
  { mode: 0o755 },
);
chmodSync(hookPath, 0o755);

console.log(`[install-hooks] ติดตั้ง pre-commit hook ที่ ${hookPath}`);
