/**
 * Boots the standalone bundle exactly the way the desktop app does and checks
 * that the server, the bundled fonts and the pdf.js worker are all reachable.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.VERIFY_PORT ?? 41831);
const BASE = `http://127.0.0.1:${PORT}`;
const standalone = path.join(import.meta.dirname, '..', '.next', 'standalone');
const entry = path.join(standalone, 'apps', 'web', 'server.js');

const server = spawn(process.execPath, [entry], {
  cwd: path.dirname(entry),
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(PORT),
    HOSTNAME: '127.0.0.1',
    // Never inside the bundle: it would be packaged into the desktop app.
    MEDF_DATA_DIR: mkdtempSync(path.join(tmpdir(), 'medf-verify-')),
    MEDF_SESSION_SECRET: 'verify-standalone-secret-verify-standalone',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

const logs = [];
server.stdout.on('data', (chunk) => logs.push(String(chunk)));
server.stderr.on('data', (chunk) => logs.push(String(chunk)));

let failed = false;
function check(label, ok, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failed = true;
}

try {
  const deadline = Date.now() + 60_000;
  let health = null;
  while (Date.now() < deadline && !health) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) health = await response.json();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  check('standalone server ตอบสนอง', Boolean(health?.ok), logs.join('').slice(-1200));
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
  server.kill('SIGTERM');
}

if (failed) {
  console.error('\n--- server log ---\n' + logs.join('').slice(-2000));
  process.exitCode = 1;
} else {
  console.log('\n✅ standalone bundle พร้อมนำไปแพ็กเป็นแอป Windows');
}
