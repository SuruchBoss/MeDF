/**
 * Shared plumbing for the end-to-end test scripts.
 *
 * `smoke-test`, `ui-test`, `demo-test`, `verify-standalone` and the demo's
 * `static-test` each used to carry their own copy of most of this. The copies
 * had already drifted — three subtly different `findChromium`s, two `check`s
 * with different failure behaviour, and four fixed ports where a leftover
 * process silently makes a test drive the wrong server.
 *
 * Nothing here knows anything about MeDF; it is only the scaffolding.
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';

const require = createRequire(import.meta.url);

/**
 * Counts assertions and prints them as it goes.
 *
 * `failFast` stops at the first failure, for a script whose later steps depend
 * on the earlier ones (registering before uploading, say). Without it every
 * check runs, so one run shows everything that is broken.
 */
export function createChecker({ failFast = false, name = 'ทดสอบ' } = {}) {
  let passed = 0;
  let failed = false;

  function check(label, ok, detail = '') {
    if (ok) {
      passed += 1;
      console.log(`  ✓ ${label}`);
      return true;
    }
    const message = `✗ ${label}${detail ? ` — ${detail}` : ''}`;
    if (failFast) throw new Error(message);
    console.log(`  ${message}`);
    failed = true;
    return false;
  }

  /** A numbered heading, so a long run stays readable. */
  let sectionNumber = 0;
  function section(title) {
    sectionNumber += 1;
    console.log(`\n[${sectionNumber}] ${title}`);
  }

  /** Prints the tally and returns the exit code the script should use. */
  function report() {
    if (failed) {
      console.error(`\n❌ ${name}: มีข้อที่ไม่ผ่าน (ผ่าน ${passed} ข้อ)`);
      return 1;
    }
    console.log(`\n✅ ผ่านทั้งหมด ${passed} ข้อ`);
    return 0;
  }

  return {
    check,
    section,
    report,
    get passed() {
      return passed;
    },
    get failed() {
      return failed;
    },
  };
}

/**
 * A TCP port nobody else holds.
 *
 * A fixed port is a trap: if something is already listening, the test happily
 * drives *that* server instead and its results mean nothing. `envVar` still
 * lets a caller pin one when they need to attach a debugger.
 */
export async function freePort(envVar) {
  const pinned = envVar ? Number(process.env[envVar]) : NaN;
  if (Number.isInteger(pinned) && pinned > 0) return pinned;
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/** Playwright, wherever it happens to be installed. */
export function loadPlaywright() {
  for (const id of ['playwright', 'playwright-core', '/opt/node22/lib/node_modules/playwright']) {
    try {
      return require(id);
    } catch {
      /* try the next location */
    }
  }
  throw new Error('ไม่พบ playwright — ติดตั้งด้วย `npm install` ที่รากโปรเจกต์');
}

/**
 * The Chromium binary to drive.
 *
 * Playwright normally resolves this itself, but a sandboxed environment often
 * has the browsers somewhere else and only sets `PLAYWRIGHT_BROWSERS_PATH`.
 * Returning `undefined` means "let Playwright decide", which is correct when
 * the browsers are where it expects.
 */
export function findChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;
  const direct = path.join(root, 'chromium');
  if (existsSync(direct)) return direct;
  return readdirSync(root)
    .filter((name) => name.startsWith('chromium-'))
    .map((name) => path.join(root, name, 'chrome-linux', 'chrome'))
    .find((candidate) => existsSync(candidate));
}

/**
 * Spawns a server process and keeps its output.
 *
 * The logs are kept because a failed boot is otherwise invisible behind a
 * timeout: all the caller sees is "did not respond".
 */
export function startServer({ command = process.execPath, args, cwd, env = {} }) {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logs = [];
  child.stdout.on('data', (chunk) => logs.push(String(chunk)));
  child.stderr.on('data', (chunk) => logs.push(String(chunk)));

  return {
    child,
    /** The server's output so far — print it when a boot times out. */
    output: () => logs.join(''),
    stop: () => child.kill('SIGTERM'),
  };
}

/**
 * `next start` against a built app. The CLI is resolved through Node rather
 * than by name, so workspace hoisting does not matter.
 */
export function startNextServer({ cwd, port, env = {} }) {
  return startServer({
    args: [require.resolve('next/dist/bin/next'), 'start', '-p', String(port)],
    cwd,
    env: { NODE_ENV: 'production', ...env },
  });
}

/** A plain static file server, the way GitHub Pages serves the demo. */
export function startStaticServer({ cwd, port }) {
  return startServer({
    args: [require.resolve('http-server/bin/http-server'), '-p', String(port), '-c-1', '--silent', '.'],
    cwd,
  });
}

/** Polls `url` until it answers, or gives up with the server's own output. */
export async function waitForHttp(url, { timeoutMs = 90_000, server = null } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  const tail = server?.output().slice(-2000) ?? '';
  throw new Error(`เซิร์ฟเวอร์ไม่ตอบสนองภายในเวลาที่กำหนด (${url})${tail ? `\n${tail}` : ''}`);
}

/**
 * A cookie jar over `fetch`, so a script can act as a signed-in member.
 *
 * Redirects are not followed: a test that expects a 302 should see the 302.
 */
export class Session {
  constructor(base) {
    this.base = base;
    this.cookies = new Map();
  }

  header() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  absorb(response) {
    for (const cookie of response.headers.getSetCookie?.() ?? []) {
      const [pair] = cookie.split(';');
      const index = pair.indexOf('=');
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (value === '') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  async fetch(url, init = {}) {
    const headers = new Headers(init.headers);
    const cookie = this.header();
    if (cookie) headers.set('cookie', cookie);
    const response = await fetch(`${this.base}${url}`, { ...init, headers, redirect: 'manual' });
    this.absorb(response);
    return response;
  }

  async json(url, init) {
    const response = await this.fetch(url, init);
    const body = await response.json().catch(() => null);
    return { status: response.status, body, response };
  }
}

/** Pulls the text layer out of a PDF with pdf.js. */
export async function extractPdfText(bytes) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: bytes, isEvalSupported: false });
  const document = await task.promise;
  const parts = [];
  for (let index = 1; index <= document.numPages; index += 1) {
    const content = await (await document.getPage(index)).getTextContent();
    parts.push(content.items.map((item) => item.str ?? '').join(''));
  }
  await task.destroy();
  return parts.join('\n');
}
