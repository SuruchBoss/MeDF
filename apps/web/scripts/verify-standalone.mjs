/**
 * Boots the standalone bundle exactly the way the desktop app does and checks
 * that the server, the bundled fonts and the pdf.js worker are all reachable.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createChecker, freePort, startServer, waitForHttp } from '../../../scripts/test-harness.mjs';

const PORT = await freePort('VERIFY_PORT');
const BASE = `http://127.0.0.1:${PORT}`;
const standalone = path.join(import.meta.dirname, '..', '.next', 'standalone');
const entry = path.join(standalone, 'apps', 'web', 'server.js');

const server = startServer({
  args: [entry],
  cwd: path.dirname(entry),
  env: {
    NODE_ENV: 'production',
    PORT: String(PORT),
    HOSTNAME: '127.0.0.1',
    // Never inside the bundle: it would be packaged into the desktop app.
    MEDF_DATA_DIR: mkdtempSync(path.join(tmpdir(), 'medf-verify-')),
    MEDF_SESSION_SECRET: 'verify-standalone-secret-verify-standalone',
  },
});

const { check, report } = createChecker({ name: 'ตรวจ standalone bundle' });

try {
  const health = await waitForHttp(`${BASE}/api/health`, { timeoutMs: 60_000, server })
    .then((response) => response.json())
    .catch(() => null);

  check('standalone server ตอบสนอง', health?.ok === true, server.output().slice(-1200));
  if (health) {
    const landing = await fetch(BASE);
    check('หน้า landing แสดงผลได้', landing.ok);
    const html = await landing.text();
    check('หน้า landing มีเนื้อหาภาษาไทย', html.includes('MeDF'));

    const worker = await fetch(`${BASE}/pdf.worker.min.mjs`);
    check('เสิร์ฟ pdf.js worker ได้', worker.ok && worker.headers.get('content-length') !== '0');

    const font = await fetch(`${BASE}/fonts/Sarabun-Regular.ttf`);
    check('เสิร์ฟฟอนต์ Sarabun ได้', font.ok);

    const login = await fetch(`${BASE}/login`);
    check('หน้าเข้าสู่ระบบแสดงผลได้', login.ok);
  }
} finally {
  server.stop();
}

const code = report();
if (code !== 0) console.error('\n--- server log ---\n' + server.output().slice(-2000));
else console.log('   standalone bundle พร้อมนำไปแพ็กเป็นแอป Windows');
process.exitCode = code;
