/**
 * Desktop development: starts `next dev` and opens the Electron shell against
 * it, so UI changes hot-reload inside the real desktop window.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';

const require = createRequire(import.meta.url);
const repoRoot = path.join(import.meta.dirname, '..', '..');
const PORT = Number(process.env.MEDF_DEV_PORT ?? 4173);
const DEV_URL = `http://127.0.0.1:${PORT}`;

const web = spawn('npm', ['run', 'dev', '--workspace', 'medf-web'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, PORT: String(PORT) },
});

function waitForPort(timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (Date.now() > deadline) return reject(new Error('next dev ไม่พร้อมใช้งาน'));
      const socket = net.connect({ host: '127.0.0.1', port: PORT }, () => {
        socket.end();
        resolve();
      });
      socket.on('error', () => {
        socket.destroy();
        setTimeout(attempt, 400);
      });
    };
    attempt();
  });
}

await waitForPort();

const electron = spawn(require('electron'), [path.join(import.meta.dirname, '..')], {
  stdio: 'inherit',
  env: { ...process.env, MEDF_DEV_URL: DEV_URL },
});

function shutdown() {
  web.kill('SIGTERM');
  electron.kill('SIGTERM');
}

electron.on('exit', () => {
  shutdown();
  process.exit(0);
});
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
