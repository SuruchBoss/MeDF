/**
 * Keeps paid-tier source code out of the public repository.
 *
 * MeDF is open core: this repository is the free tier and is meant to be
 * readable. Paid add-ons live in a separate private module (see
 * `docs/OPEN_CORE.md`). This guard fails when any private path is staged,
 * tracked or committed, so a mistake cannot become a public push.
 *
 * It runs as a git pre-commit hook (`npm run setup:hooks`) and in CI, so both
 * a local commit and a force-pushed branch are covered.
 */
import { execFileSync } from 'node:child_process';

/** Paths that must never exist in git history. */
const PRIVATE_PATTERNS = [
  /(^|\/)pro-private(\/|$)/,
  /(^|\/)medf-pro(\/|$)/,
  /(^|\/)private-modules?(\/|$)/,
  /\.pro\.(ts|tsx|js|mjs|cjs)$/,
  /(^|\/)\.medf-pro(\/|$)/,
];

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function matches(paths) {
  return paths.filter((file) => file && PRIVATE_PATTERNS.some((pattern) => pattern.test(file)));
}

const staged = git(['diff', '--cached', '--name-only']).split('\n');
const tracked = git(['ls-files']).split('\n');

const offenders = [...new Set([...matches(staged), ...matches(tracked)])];

if (offenders.length > 0) {
  console.error('\n✗ พบไฟล์ของฟีเจอร์แบบชำระเงินอยู่ใน git:\n');
  for (const file of offenders) console.error(`    ${file}`);
  console.error(
    [
      '',
      'ไฟล์เหล่านี้ต้องไม่อยู่ใน repository สาธารณะ',
      'วิธีแก้: git rm --cached <ไฟล์>  แล้วเก็บโค้ดไว้ใน repo ส่วนตัวหรือแพ็กเกจ @medf/pro',
      'อ่านเพิ่มที่ docs/OPEN_CORE.md',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

console.log('✓ ไม่มีโค้ดฟีเจอร์แบบชำระเงินอยู่ใน git');
