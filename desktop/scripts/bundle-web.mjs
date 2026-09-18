/**
 * Produces the web bundle that the desktop app ships.
 *
 * 1. builds the Next.js app in `standalone` mode,
 * 2. completes the bundle (public assets + client chunks),
 * 3. copies it to `desktop/resources/app`, which electron-builder packs as an
 *    unpacked resource so the server can be spawned as a child process.
 */
import { spawnSync } from 'node:child_process';
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const desktopRoot = path.join(import.meta.dirname, '..');
const repoRoot = path.join(desktopRoot, '..');
const webRoot = path.join(repoRoot, 'apps', 'web');
const standalone = path.join(webRoot, '.next', 'standalone');
const target = path.join(desktopRoot, 'resources', 'app');

function run(command, args, cwd) {
  console.log(`\n$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) {
    console.error(`[bundle-web] คำสั่งล้มเหลว: ${command} ${args.join(' ')}`);
    process.exit(result.status ?? 1);
  }
}

const skipBuild = process.argv.includes('--skip-build');

if (!skipBuild) {
  run('npm', ['run', 'build', '--workspace', 'medf-web'], repoRoot);
} else {
  console.log('[bundle-web] ข้ามขั้นตอน build ตามที่ระบุ (--skip-build)');
}

run(process.execPath, [path.join(webRoot, 'scripts', 'prepare-standalone.mjs')], webRoot);

try {
  await stat(path.join(standalone, 'apps', 'web', 'server.js'));
} catch {
  console.error('[bundle-web] ไม่พบผลลัพธ์ standalone — การ build อาจไม่สำเร็จ');
  process.exit(1);
}

await rm(target, { recursive: true, force: true });
await mkdir(path.dirname(target), { recursive: true });
await cp(standalone, target, { recursive: true });

console.log(`\n[bundle-web] คัดลอกไปที่ ${path.relative(repoRoot, target)} เรียบร้อย`);
