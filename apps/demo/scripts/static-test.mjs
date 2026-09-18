/**
 * Serves the exported site as plain files under a base path and drives it the
 * way GitHub Pages will: landing page, the "ลองใช้ทันที" button, the editor,
 * and an export — all with no server behind it.
 *
 * Run `npm run demo:build` first.
 */
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);

/**
 * Serve on a port nobody else holds. A fixed port is a trap here: if something
 * is already listening, the test happily drives *that* site instead and its
 * results mean nothing.
 */
function freePort() {
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

const PORT = Number(process.env.STATIC_PORT) || (await freePort());
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/MeDF';
const BASE = `http://127.0.0.1:${PORT}${BASE_PATH}`;
const demoRoot = path.join(import.meta.dirname, '..');

function findChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;
  return readdirSync(root)
    .filter((name) => name.startsWith('chromium-'))
    .map((name) => path.join(root, name, 'chrome-linux', 'chrome'))
    .find((candidate) => existsSync(candidate));
}

if (!existsSync(path.join(demoRoot, 'out', 'index.html'))) {
  console.error('[static-test] ไม่พบผลลัพธ์ที่ apps/demo/out — รัน `npm run demo:build` ก่อน');
  process.exit(1);
}

// Lay the export out exactly as Pages does: under /<repo>/.
const siteRoot = await mkdtemp(path.join(tmpdir(), 'medf-pages-'));
await cp(path.join(demoRoot, 'out'), path.join(siteRoot, BASE_PATH.replace(/^\//, '')), {
  recursive: true,
});

const fileServer = spawn(
  process.execPath,
  [require.resolve('http-server/bin/http-server'), '-p', String(PORT), '-c-1', '--silent', '.'],
  { cwd: siteRoot, stdio: ['ignore', 'pipe', 'pipe'] },
);

const deadline = Date.now() + 60_000;
while (Date.now() < deadline) {
  try {
    if ((await fetch(`${BASE}/`)).ok) break;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}

const { chromium } = require('playwright');

let failed = false;
const ok = (l, c, d = '') => { console.log(`  ${c ? '✓' : '✗'} ${l}${c || !d ? '' : ` — ${d}`}`); if (!c) failed = true; };

const b = await chromium.launch({
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  executablePath: findChromium(),
});
const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [], bad = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${new URL(r.url()).pathname}`); });

console.log('\n[1] Landing page (static)');
await page.goto(`${BASE}/`, { waitUntil: 'load' });
ok('หน้า landing โหลดได้', (await page.title()).includes('MeDF'), await page.title());
ok('มีหัวข้อหลัก', (await page.getByRole('heading', { level: 1 }).first().innerText()).includes('PDF'));
ok('ปุ่ม “ลองใช้ทันที” อยู่ใน header', (await page.locator('header a:has-text("ลองใช้ทันที")').count()) > 0);
ok('ไม่มีปุ่มเข้าสู่ระบบ/สมัคร (ไม่มีเซิร์ฟเวอร์)', (await page.locator('header a:has-text("เข้าสู่ระบบ")').count()) === 0);
ok('มีลิงก์ไป GitHub', (await page.locator('header a:has-text("GitHub")').count()) > 0);
ok('ส่วนแพ็กเกจแสดงผล', (await page.locator('#pricing').count()) > 0);
ok('ฟอนต์ Sarabun ถูกใช้', await page.evaluate(() => getComputedStyle(document.body).fontFamily.includes('Sarabun')));
await page.screenshot({ path: path.join(siteRoot, 'landing.png') });

console.log('\n[2] ไปหน้าทดลองใช้ผ่านปุ่มบน landing');
await page.locator('header a:has-text("ลองใช้ทันที")').first().click();
await page.waitForURL('**/try/**', { timeout: 30000 });
ok('ปุ่มพาไปหน้า /try ได้', page.url().includes(`${BASE_PATH}/try`), page.url());
await page.waitForSelector('button:has-text("ใช้เอกสารตัวอย่าง"):not([disabled])', { timeout: 60000 });
ok('หน้า /try พร้อมใช้งาน (hydrate สำเร็จ)', true);

console.log('\n[3] เล่นจริงในฐานะ Free tier');
await page.click('button:has-text("ใช้เอกสารตัวอย่าง")');
await page.waitForSelector('[data-page-index="0"] canvas', { timeout: 90000 });
// `canvas.width` is set before pdf.js paints, so waiting on it races the
// render; `data-rendered` flips only once the page is actually painted.
await page.waitForSelector('[data-page-index="0"] canvas[data-rendered="true"]', { timeout: 90000 });
const ink = await page.evaluate(() => {
  const c = document.querySelector('[data-page-index="0"] canvas');
  const { data } = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
  let n = 0; for (let i = 0; i < data.length; i += 4) if (data[i] < 200) n++;
  return n / (data.length / 4);
});
ok(`pdf.js เรนเดอร์เอกสารได้จากไฟล์สถิต (${(ink * 100).toFixed(2)}% หมึก)`, ink > 0.002, String(ink));

const stage = await page.locator('[data-page-index="0"]').boundingBox();
await page.click('button[title^="กล่องข้อความ"]');
await page.mouse.click(stage.x + stage.width * 0.4, stage.y + Math.min(stage.height * 0.55, 640));
await page.waitForSelector('[data-element-id]', { timeout: 20000 });
const el = page.locator('[data-element-id]').first();
await el.dblclick();
await page.waitForSelector('[data-element-id] textarea');
await page.keyboard.press('Control+A');
await page.keyboard.type('เล่นจาก GitHub Pages');
await page.locator('[data-page-index="0"]').click({ position: { x: 8, y: 8 } });
ok('วางและพิมพ์ข้อความไทยได้', (await el.locator('.element-text').innerText()).includes('เล่นจาก GitHub Pages'));

console.log('\n[4] Export จากไฟล์สถิต');
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.click('button:has-text("Export PDF")')]);
const exported = path.join(siteRoot, 'export.pdf');
await dl.saveAs(exported);
const bytes = new Uint8Array(await readFile(exported));
ok('ดาวน์โหลด PDF ได้', bytes.byteLength > 1000, `${bytes.byteLength} bytes`);
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
let text = '';
for (let i = 1; i <= doc.numPages; i++) text += (await (await doc.getPage(i)).getTextContent()).items.map(x => x.str).join('');
ok('ไฟล์มีข้อความที่พิมพ์', text.includes('เล่นจาก GitHub Pages'), text.slice(0, 120));
ok('มีลายน้ำ Free tier', text.includes('MeDF'));
await page.screenshot({ path: path.join(siteRoot, 'editor.png') });

const real = errors.filter(e => !/favicon|Failed to load resource|ERR_ABORTED/i.test(e));
ok('ไม่มี error ใน console', real.length === 0, real.slice(0, 2).join(' | '));
ok('ไม่มี request ที่ตอบ 4xx/5xx', bad.filter(x => !x.includes('favicon')).length === 0, bad.join(', '));
await b.close();
fileServer.kill('SIGTERM');
if (process.env.MEDF_KEEP_STATIC) console.log(`\nไฟล์ผลลัพธ์: ${siteRoot}`);
else await rm(siteRoot, { recursive: true, force: true });

if (failed) process.exitCode = 1;
else console.log('\n✅ เว็บสถิตแบบที่ GitHub Pages จะเสิร์ฟ เล่นได้จริง');
