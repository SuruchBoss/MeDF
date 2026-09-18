/**
 * Serves the exported site as plain files under a base path and drives it the
 * way GitHub Pages will: landing page, the "ลองใช้ทันที" button, the editor,
 * and an export — all with no server behind it.
 *
 * Run `npm run demo:build` first.
 */
import { existsSync } from 'node:fs';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createChecker,
  extractPdfText,
  findChromium,
  freePort,
  loadPlaywright,
  startStaticServer,
  waitForHttp,
} from '../../../scripts/test-harness.mjs';

const PORT = await freePort('STATIC_PORT');
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '/MeDF';
const BASE = `http://127.0.0.1:${PORT}${BASE_PATH}`;
const demoRoot = path.join(import.meta.dirname, '..');

if (!existsSync(path.join(demoRoot, 'out', 'index.html'))) {
  console.error('[static-test] ไม่พบผลลัพธ์ที่ apps/demo/out — รัน `npm run demo:build` ก่อน');
  process.exit(1);
}

// Lay the export out exactly as Pages does: under /<repo>/.
const siteRoot = await mkdtemp(path.join(tmpdir(), 'medf-pages-'));
await cp(path.join(demoRoot, 'out'), path.join(siteRoot, BASE_PATH.replace(/^\//, '')), {
  recursive: true,
});

const server = startStaticServer({ cwd: siteRoot, port: PORT });
const { check, section, report } = createChecker({ name: 'ทดสอบเว็บสถิต' });

let failed = false;
let browser;
try {
  await waitForHttp(`${BASE}/`, { timeoutMs: 60_000, server });

  const { chromium } = loadPlaywright();
  browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    executablePath: findChromium(),
  });
  const context = await browser.newContext({
    // Pin the language: the app now picks a locale from Accept-Language, and
    // these assertions are written in Thai. Without this the browser's own
    // default would decide which language the test is reading.
    locale: 'th-TH',
    viewport: { width: 1500, height: 950 },
    acceptDownloads: true,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const badResponses = [];
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      badResponses.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });

  section('Landing page (static)');
  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  const title = await page.title();
  check('หน้า landing โหลดได้', title.includes('MeDF'), title);
  check(
    'มีหัวข้อหลัก',
    (await page.getByRole('heading', { level: 1 }).first().innerText()).includes('PDF'),
  );
  check(
    'ปุ่ม “ลองใช้ทันที” อยู่ใน header',
    (await page.locator('header a:has-text("ลองใช้ทันที")').count()) > 0,
  );
  check(
    'ไม่มีปุ่มเข้าสู่ระบบ/สมัคร (ไม่มีเซิร์ฟเวอร์)',
    (await page.locator('header a:has-text("เข้าสู่ระบบ")').count()) === 0,
  );
  check('มีลิงก์ไป GitHub', (await page.locator('header a:has-text("GitHub")').count()) > 0);
  check('ส่วนแพ็กเกจแสดงผล', (await page.locator('#pricing').count()) > 0);
  check(
    'ฟอนต์ Sarabun ถูกใช้',
    await page.evaluate(() => getComputedStyle(document.body).fontFamily.includes('Sarabun')),
  );
  await page.screenshot({ path: path.join(siteRoot, 'landing.png') });

  section('ไปหน้าทดลองใช้ผ่านปุ่มบน landing');
  await page.locator('header a:has-text("ลองใช้ทันที")').first().click();
  await page.waitForURL('**/try/**', { timeout: 30_000 });
  check('ปุ่มพาไปหน้า /try ได้', page.url().includes(`${BASE_PATH}/try`), page.url());
  await page.waitForSelector('button:has-text("ใช้เอกสารตัวอย่าง"):not([disabled])', {
    timeout: 60_000,
  });
  check('หน้า /try พร้อมใช้งาน (hydrate สำเร็จ)', true);

  section('เล่นจริงในฐานะ Free tier');
  await page.click('button:has-text("ใช้เอกสารตัวอย่าง")');
  // `canvas.width` is set before pdf.js paints, so waiting on it races the
  // render; `data-rendered` flips only once the page is actually painted.
  await page.waitForSelector('[data-page-index="0"] canvas[data-rendered="true"]', {
    timeout: 90_000,
  });

  // A blank canvas of the right size is not a rendered page: count the pixels
  // that are not white.
  const inkRatio = await page.evaluate(() => {
    const canvas = document.querySelector('[data-page-index="0"] canvas');
    const { data } = canvas
      .getContext('2d', { willReadFrequently: true })
      .getImageData(0, 0, canvas.width, canvas.height);
    let inked = 0;
    for (let index = 0; index < data.length; index += 4) if (data[index] < 200) inked += 1;
    return inked / (data.length / 4);
  });
  check(
    `pdf.js เรนเดอร์เอกสารได้จากไฟล์สถิต (${(inkRatio * 100).toFixed(2)}% หมึก)`,
    inkRatio > 0.002,
    String(inkRatio),
  );

  const stage = await page.locator('[data-page-index="0"]').boundingBox();
  await page.click('button[title^="กล่องข้อความ"]');
  await page.mouse.click(
    stage.x + stage.width * 0.4,
    stage.y + Math.min(stage.height * 0.55, 640),
  );
  await page.waitForSelector('[data-element-id]', { timeout: 20_000 });

  const element = page.locator('[data-element-id]').first();
  await element.dblclick();
  await page.waitForSelector('[data-element-id] textarea');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('เล่นจาก GitHub Pages');
  await page.locator('[data-page-index="0"]').click({ position: { x: 8, y: 8 } });
  check(
    'วางและพิมพ์ข้อความไทยได้',
    (await element.locator('.element-text').innerText()).includes('เล่นจาก GitHub Pages'),
  );

  section('Export จากไฟล์สถิต');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 120_000 }),
    page.click('button:has-text("Export PDF")'),
  ]);
  const exported = path.join(siteRoot, 'export.pdf');
  await download.saveAs(exported);
  const bytes = new Uint8Array(await readFile(exported));
  check('ดาวน์โหลด PDF ได้', bytes.byteLength > 1000, `${bytes.byteLength} bytes`);

  const text = await extractPdfText(bytes);
  check('ไฟล์มีข้อความที่พิมพ์', text.includes('เล่นจาก GitHub Pages'), text.slice(0, 120));
  check('มีลายน้ำ Free tier', text.includes('MeDF'));
  await page.screenshot({ path: path.join(siteRoot, 'editor.png') });

  const realErrors = consoleErrors.filter(
    (message) => !/favicon|Failed to load resource|ERR_ABORTED/i.test(message),
  );
  check('ไม่มี error ใน console', realErrors.length === 0, realErrors.slice(0, 2).join(' | '));
  check(
    'ไม่มี request ที่ตอบ 4xx/5xx',
    badResponses.filter((entry) => !entry.includes('favicon')).length === 0,
    badResponses.join(', '),
  );
} catch (error) {
  failed = true;
  console.error(`\n❌ ${error.message}`);
  console.error('\n--- server log ---\n' + server.output().slice(-1500));
} finally {
  await browser?.close().catch(() => undefined);
  server.stop();
  if (process.env.MEDF_KEEP_STATIC) console.log(`\nไฟล์ผลลัพธ์: ${siteRoot}`);
  else await rm(siteRoot, { recursive: true, force: true });
}

const code = failed ? 1 : report();
if (code === 0) console.log('   เว็บสถิตแบบที่ GitHub Pages จะเสิร์ฟ เล่นได้จริง');
process.exitCode = code;
