/**
 * Completes the `output: 'standalone'` bundle.
 *
 * Next.js traces the server code but, by design, does not copy `public/` in
 * full or `.next/static` — the host is expected to. The desktop build has no
 * host, so we do it here and the result is a directory that runs with nothing
 * but `node server.js`.
 */
import { cp, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const webRoot = path.join(import.meta.dirname, '..');
const standalone = path.join(webRoot, '.next', 'standalone');
const target = path.join(standalone, 'apps', 'web');

async function exists(candidate) {
  try {
    await stat(candidate);
    return true;
  } catch {
    return false;
  }
}

if (!(await exists(path.join(target, 'server.js')))) {
  console.error(
    `[prepare-standalone] ไม่พบ ${path.join(target, 'server.js')} — กรุณารัน "next build" ก่อน`,
  );
  process.exit(1);
}

await mkdir(path.join(target, '.next'), { recursive: true });
await cp(path.join(webRoot, 'public'), path.join(target, 'public'), { recursive: true });
await cp(path.join(webRoot, '.next', 'static'), path.join(target, '.next', 'static'), {
  recursive: true,
});

// Sanity-check the assets the app cannot start without.
const required = [
  path.join(target, 'public', 'pdf.worker.min.mjs'),
  path.join(target, 'public', 'fonts', 'Sarabun-Regular.ttf'),
  path.join(target, '.next', 'static'),
];
for (const item of required) {
  if (!(await exists(item))) {
    console.error(`[prepare-standalone] ขาดไฟล์ที่จำเป็น: ${item}`);
    process.exit(1);
  }
}

const { version } = JSON.parse(await readFile(path.join(webRoot, 'package.json'), 'utf8'));
await writeFile(
  path.join(standalone, 'medf-bundle.json'),
  `${JSON.stringify({ version, entry: 'apps/web/server.js', builtAt: new Date().toISOString() }, null, 2)}\n`,
);

console.log(`[prepare-standalone] พร้อมใช้งานที่ ${path.relative(process.cwd(), standalone)}`);
