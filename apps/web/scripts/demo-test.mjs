/**
 * Browser test for the try-it-now editor.
 *
 * Drives `/try` the way a visitor does — generate the sample document, place
 * and edit elements, export — and asserts that no request ever leaves for an
 * API route. That last check is what guarantees the page still works as a
 * static file on GitHub Pages.
 */
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createChecker,
  findChromium,
  freePort,
  loadPlaywright,
  startNextServer,
  waitForHttp,
} from '../../../scripts/test-harness.mjs';

/**
 * The Next.js app directory, resolved from this file rather than from the
 * caller's working directory — these scripts are run from the repository root
 * (`npm run test:demo`) as well as from `apps/web`.
 */
const webRoot = path.join(import.meta.dirname, '..');

const PORT = await freePort('DEMO_PORT');
const BASE = `http://127.0.0.1:${PORT}`;

const { check, report } = createChecker({ name: 'ทดสอบโหมดทดลอง' });

const dataDir = await mkdtemp(path.join(tmpdir(), 'medf-demo-'));
const server = startNextServer({
  cwd: webRoot,
  port: PORT,
  env: {
    MEDF_DATA_DIR: dataDir,
    MEDF_SESSION_SECRET: 'demo-test-secret-demo-test-secret-demo',
  },
});

let failed = false;
let browser;
try {
  await waitForHttp(`${BASE}/api/health`, { server });

  const { chromium } = loadPlaywright();
  browser = await browserLaunch(chromium);
  const context = await browser.newContext({
    viewport: { width: 1500, height: 950 },
    acceptDownloads: true,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const apiCalls = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/')) apiCalls.push(`${request.method()} ${url.pathname}`);
  });

  console.log('\n[1] เปิดหน้าทดลองใช้');
  await page.goto(`${BASE}/try`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('button:has-text("ใช้เอกสารตัวอย่าง"):not([disabled])', {
    timeout: 60_000,
  });
  check('หน้า /try แสดงตัวเลือกเริ่มต้นได้', true);
  check(
    'บอกข้อจำกัดของแพ็กเกจ Free',
    (await page.getByText('โหมดทดลอง · แพ็กเกจ Free').count()) > 0,
  );

  console.log('\n[2] สร้างเอกสารตัวอย่างในเบราว์เซอร์');
  await page.click('button:has-text("ใช้เอกสารตัวอย่าง")');
  await page.waitForSelector('[data-page-index="0"] canvas', { timeout: 90_000 });
  // `canvas.width` is set before pdf.js paints, so waiting on it races the
  // render; `data-rendered` flips only once the page is actually painted.
  await page.waitForSelector('[data-page-index="0"] canvas[data-rendered="true"]', {
    timeout: 90_000,
  });
  const ink = await page.evaluate(() => {
    const canvas = document.querySelector('[data-page-index="0"] canvas');
    const { data } = canvas
      .getContext('2d', { willReadFrequently: true })
      .getImageData(0, 0, canvas.width, canvas.height);
    let dark = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] < 200) dark += 1;
    }
    return dark / (data.length / 4);
  });
  check(
    `เรนเดอร์เอกสารตัวอย่าง (มีข้อความไทย ${(ink * 100).toFixed(2)}% ของพื้นที่)`,
    ink > 0.002,
    String(ink),
  );

  console.log('\n[3] แก้ไขในโหมดทดลอง');
  const stage = await page.locator('[data-page-index="0"]').boundingBox();
  await page.click('button[title^="กล่องข้อความ"]');
  await page.mouse.click(stage.x + stage.width * 0.4, stage.y + Math.min(stage.height * 0.5, 620));
  await page.waitForSelector('[data-element-id]', { timeout: 20_000 });
  check('วางกล่องข้อความได้', (await page.locator('[data-element-id]').count()) === 1);

  const element = page.locator('[data-element-id]').first();
  await element.dblclick();
  await page.waitForSelector('[data-element-id] textarea', { timeout: 20_000 });
  await page.keyboard.press('Control+A');
  await page.keyboard.type('ทดลองใช้จากหน้าเว็บ');
  await page.locator('[data-page-index="0"]').click({ position: { x: 8, y: 8 } });
  check(
    'พิมพ์ข้อความไทยได้',
    (await page.locator('[data-element-id] .element-text').first().innerText()).includes(
      'ทดลองใช้จากหน้าเว็บ',
    ),
  );

  // Drag it, to prove the gestures work in the demo build too.
  const box = await element.boundingBox();
  await page.keyboard.down('Alt');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 30, { steps: 10 });
  await page.mouse.up();
  await page.keyboard.up('Alt');
  const moved = await element.boundingBox();
  check(
    'ลากย้ายองค์ประกอบได้',
    Math.abs(moved.x - box.x - 60) < 4 && Math.abs(moved.y - box.y - 30) < 4,
  );

  console.log('\n[4] Export ในเบราว์เซอร์ล้วน');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 120_000 }),
    page.click('button:has-text("Export PDF")'),
  ]);
  const exported = path.join(dataDir, 'demo-export.pdf');
  await download.saveAs(exported);
  const bytes = new Uint8Array(await readFile(exported));
  check('ดาวน์โหลดไฟล์ PDF ได้', bytes.byteLength > 1000, `${bytes.byteLength} bytes`);

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
  let text = '';
  for (let index = 1; index <= doc.numPages; index += 1) {
    text += (await (await doc.getPage(index)).getTextContent()).items
      .map((item) => item.str ?? '')
      .join('');
  }
  check('ไฟล์มีข้อความที่พิมพ์ไว้', text.includes('ทดลองใช้จากหน้าเว็บ'), text.slice(0, 160));
  check(
    'ไฟล์ยังมีเนื้อหาของเอกสารตัวอย่าง',
    text.includes('กรุงเทพมหานคร'),
    text.slice(0, 160),
  );
  // Known fidelity note: shaping the embedded font splits SARA AM (ำ, U+0E33)
  // into two glyphs, and the reverse mapping reports it as U+0E33 U+0E32. The
  // page *renders* correctly; only text copied out of the file is affected, so
  // compare normalised. See docs/ARCHITECTURE.md.
  const normalise = (value) => value.replaceAll('\u0e33\u0e32', '\u0e33');
  check(
    'ข้อความที่มีสระอำ ตรงกันเมื่อ normalise (ดู docs/ARCHITECTURE.md)',
    normalise(text).includes('สัญญาจ้างทำงาน'),
    normalise(text).slice(0, 120),
  );
  check('แพ็กเกจ Free ใส่ลายน้ำให้', text.includes('MeDF'), text.slice(-120));

  console.log('\n[5] ไม่มีการอัปโหลดไฟล์ออกจากเครื่อง');
  check(
    'ไม่มีการเรียก API ใด ๆ ระหว่างใช้งาน',
    apiCalls.length === 0,
    apiCalls.join(', ') || 'none',
  );

  const ignorable = [/favicon/i, /Failed to load resource/i, /ERR_ABORTED/i];
  const realErrors = consoleErrors.filter(
    (message) => !ignorable.some((pattern) => pattern.test(message)),
  );
  check('ไม่มี error ใน console', realErrors.length === 0, realErrors.slice(0, 2).join(' | '));

  await page.screenshot({ path: path.join(dataDir, 'demo.png') });
  if (process.env.MEDF_KEEP_DEMO_DATA) console.log(`\nไฟล์ผลลัพธ์: ${dataDir}`);
} catch (error) {
  failed = true;
  console.error(`\n❌ ${error.message}`);
  console.error('\n--- server log ---\n' + server.output().slice(-1500));
} finally {
  await browser?.close().catch(() => undefined);
  server.stop();
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (!process.env.MEDF_KEEP_DEMO_DATA) await rm(dataDir, { recursive: true, force: true });
}

process.exitCode = failed ? 1 : report();

function browserLaunch(chromium) {
  return chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    executablePath: findChromium(),
  });
}
