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
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import { tmpdir } from 'node:os';
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

/**
 * The base path a static export was built with, read from the build itself.
 *
 * `NEXT_PUBLIC_BASE_PATH` is baked into every asset URL at build time, so the
 * build is the only reliable witness: an environment variable set (or not)
 * when the tests run can disagree with the one set when the site was built,
 * and then every script and stylesheet 404s. That mismatch is exactly what
 * kept the Pages deploy red (#24).
 */
export function readBasePath(outDir) {
  const indexFile = path.join(outDir, 'index.html');
  if (!existsSync(indexFile)) {
    throw new Error(`ไม่พบ ${indexFile} — รัน \`npm run build\` ก่อน`);
  }
  const match = readFileSync(indexFile, 'utf8').match(/(?:src|href)="([^"]*?)\/_next\/static\//);
  if (!match) throw new Error(`อ่าน base path จาก ${indexFile} ไม่ได้ — ไม่พบ URL ของ /_next/static/`);
  return match[1];
}

/**
 * A plain static file server, the way GitHub Pages serves the site.
 *
 * Pages serves a project site under `/<repo>/`, so a build made for it asks
 * for `/<repo>/_next/...`. Serving `outDir` at the root would 404 every one of
 * those requests and the page would never hydrate. With a `basePath`, the
 * folder is mounted at that path instead, through a symlink in a temporary
 * root, so the test sees the same URLs a visitor does.
 */
export function startStaticServer({ cwd, port, basePath = '' }) {
  let root = cwd;
  let mountRoot = null;
  if (basePath) {
    mountRoot = mkdtempSync(path.join(tmpdir(), 'medf-site-'));
    const mountPoint = path.join(mountRoot, ...basePath.split('/').filter(Boolean));
    mkdirSync(path.dirname(mountPoint), { recursive: true });
    // 'junction' lets Windows create the link without admin rights; POSIX ignores it.
    symlinkSync(path.resolve(cwd), mountPoint, 'junction');
    root = mountRoot;
  }

  const server = startServer({
    args: [require.resolve('http-server/bin/http-server'), '-p', String(port), '-c-1', '--silent', '.'],
    cwd: root,
  });

  return {
    ...server,
    stop() {
      server.stop();
      // `rm` removes the symlink itself and never follows it into the build.
      if (mountRoot) rmSync(mountRoot, { recursive: true, force: true });
    },
  };
}

/**
 * Remembers what went wrong underneath a page, so a wait that times out can
 * say why instead of only "Timeout 90000ms exceeded".
 *
 * The page usually knows: the app shows its own error in a `role="alert"`,
 * and a request that 404s is visible to the browser. Before this, both were
 * invisible in the log and #24 cost a week of guessing.
 */
export function watchPage(page) {
  const failures = [];
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push(`HTTP ${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', (request) => {
    // A 404 is followed by an ERR_ABORTED for the same URL; one line is enough.
    if (failures.some((line) => line.endsWith(` ${request.url()}`))) return;
    failures.push(`${request.failure()?.errorText ?? 'failed'} ${request.url()}`);
  });
  page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));

  async function explain() {
    const alerts = (await page.locator('[role="alert"]').allInnerTexts().catch(() => []))
      .map((text) => text.trim())
      .filter(Boolean);
    const unique = [...new Set(failures)];
    const lines = [
      alerts.length > 0
        ? `ข้อความ error บนหน้าจอ: ${alerts.join(' | ')}`
        : 'ไม่มีข้อความ error บนหน้าจอ',
      unique.length > 0
        ? `request หรือสคริปต์ที่ล้ม (${unique.length}):\n${unique
            .slice(0, 10)
            .map((line) => `    ${line}`)
            .join('\n')}`
        : 'ไม่มี request ที่ล้ม',
    ];
    if (unique.some((line) => line.includes('/_next/'))) {
      lines.push(
        'JavaScript ของแอปโหลดไม่ได้ หน้าจึงไม่ hydrate — base path ที่เสิร์ฟตรงกับที่ build มาหรือไม่',
      );
    }
    return lines.join('\n');
  }

  return {
    explain,
    /** `page.waitForSelector`, but a timeout carries the explanation. */
    async waitFor(selector, options) {
      try {
        return await page.waitForSelector(selector, options);
      } catch (error) {
        throw new Error(`${error.message}\n\n--- สิ่งที่หน้าเว็บบอก ---\n${await explain()}`);
      }
    },
  };
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
