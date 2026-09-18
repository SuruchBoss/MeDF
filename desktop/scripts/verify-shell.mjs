/**
 * Launches the packaged desktop shell headlessly (xvfb on Linux CI, natively
 * elsewhere), walks a few routes, and checks that each one rendered. This
 * exercises the real path the Windows build uses: spawn the standalone Next
 * server as a child process, then load it in a BrowserWindow.
 */
import { spawn, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const desktopRoot = path.join(import.meta.dirname, '..');
const electronBinary = require('electron');

const outDir = await mkdtemp(path.join(tmpdir(), 'medf-shell-'));
const userData = await mkdtemp(path.join(tmpdir(), 'medf-userdata-'));

const hasXvfb =
  process.platform === 'linux' &&
  spawnSync('which', ['xvfb-run'], { stdio: 'ignore' }).status === 0;

const command = hasXvfb ? 'xvfb-run' : electronBinary;
const args = hasXvfb
  ? ['-a', '--server-args=-screen 0 1440x920x24', electronBinary, desktopRoot, '--no-sandbox']
  : [desktopRoot];

console.log(`[verify-shell] ${command} ${args.slice(0, 3).join(' ')} …`);

const child = spawn(command, args, {
  cwd: desktopRoot,
  env: {
    ...process.env,
    MEDF_SELFTEST_DIR: outDir,
    ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

const logs = [];
child.stdout.on('data', (chunk) => {
  logs.push(String(chunk));
  process.stdout.write(String(chunk));
});
child.stderr.on('data', (chunk) => logs.push(String(chunk)));

const exitCode = await new Promise((resolve) => {
  const timer = setTimeout(() => {
    child.kill('SIGKILL');
    resolve(124);
  }, 180_000);
  child.on('exit', (code) => {
    clearTimeout(timer);
    resolve(code ?? 1);
  });
});

let failed = exitCode !== 0;
function check(label, ok, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (!ok) failed = true;
}

check('แอปเปิดและปิดตัวลงอย่างปกติ', exitCode === 0, `exit ${exitCode}`);

const shots = (await readdir(outDir).catch(() => [])).filter((name) => name.endsWith('.png'));
check('ถ่ายภาพหน้าจอได้ครบ 4 หน้า', shots.length === 4, shots.join(', '));

for (const shot of shots) {
  const info = await stat(path.join(outDir, shot));
  check(`${shot} มีเนื้อหา (${Math.round(info.size / 1024)} KB)`, info.size > 8 * 1024);
}

check(
  'เส้นทาง /app พาไปหน้าเข้าสู่ระบบเมื่อยังไม่ได้ล็อกอิน',
  logs.join('').includes('/login'),
  logs.join('').slice(-400),
);

if (process.env.MEDF_KEEP_SHOTS) {
  console.log(`\nภาพหน้าจออยู่ที่: ${outDir}`);
} else {
  await rm(outDir, { recursive: true, force: true });
}
await rm(userData, { recursive: true, force: true });

if (failed) {
  console.error('\n--- electron log ---\n' + logs.join('').slice(-3000));
  process.exitCode = 1;
} else {
  console.log('\n✅ เชลล์เดสก์ท็อปทำงานได้ถูกต้อง');
}
