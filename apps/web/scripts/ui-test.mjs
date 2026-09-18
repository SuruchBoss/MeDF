/**
 * Browser test for the editor.
 *
 * Drives the real UI with Playwright: sign up, upload a PDF, place elements by
 * clicking, drag and resize them with the mouse, draw a signature, then export
 * and read the resulting PDF back. This is the only test that exercises the
 * pointer gestures, so it is the one that catches coordinate-space mistakes in
 * the stage.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { makeSamplePdf } from './make-sample-pdf.mjs';

const require = createRequire(import.meta.url);
const PORT = Number(process.env.UI_PORT ?? 41930);
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = 'UiTestPassword123';

let failed = false;
let passed = 0;
function check(label, ok, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`);
  if (ok) passed += 1;
  else failed = true;
}

function loadPlaywright() {
  for (const id of ['playwright', 'playwright-core', '/opt/node22/lib/node_modules/playwright']) {
    try {
      return require(id);
    } catch {
      /* try the next location */
    }
  }
  throw new Error('ไม่พบ playwright — ติดตั้งด้วย `npm install` ที่รากโปรเจกต์');
}

async function waitForServer(timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error('เซิร์ฟเวอร์ไม่ตอบสนอง');
}

const dataDir = await mkdtemp(path.join(tmpdir(), 'medf-ui-'));
const samplePath = path.join(dataDir, 'sample-document.pdf');
await writeFile(samplePath, await makeSamplePdf());

const nextBin = require.resolve('next/dist/bin/next');
const server = spawn('node', [nextBin, 'start', '-p', String(PORT)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'production',
    MEDF_DATA_DIR: dataDir,
    MEDF_SESSION_SECRET: 'ui-test-secret-ui-test-secret-ui-test',
    MEDF_BILLING_SANDBOX: '1',
    MEDF_APP_URL: BASE,
    // This test asserts the behaviour of the pure open-source build.
    MEDF_PRO_DISABLE: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const serverLogs = [];
server.stdout.on('data', (chunk) => serverLogs.push(String(chunk)));
server.stderr.on('data', (chunk) => serverLogs.push(String(chunk)));

let browser;
try {
  await waitForServer();
  const { chromium } = loadPlaywright();
  browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    // Honour a preinstalled browser when one is provided by the environment.
    executablePath: findChromium(),
  });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    acceptDownloads: true,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(String(error)));

  // --- Sign up ------------------------------------------------------------
  console.log('\n[1] สมัครสมาชิกผ่านหน้าเว็บ');
  await page.goto(`${BASE}/register`, { waitUntil: 'domcontentloaded' });
  await page.fill('#name', 'คุณทดสอบ');
  await page.fill('#email', 'ui@example.com');
  await page.fill('#password', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/app', { timeout: 30_000 });
  check('สมัครสมาชิกแล้วเข้าสู่หน้าเอกสาร', page.url().endsWith('/app'));
  check(
    'หน้าเอกสารแสดงพื้นที่อัปโหลด',
    await page.getByText('ลากไฟล์ PDF มาวางที่นี่').isVisible(),
  );

  // --- Upload -------------------------------------------------------------
  console.log('\n[2] อัปโหลด PDF');
  await page.locator('input[type="file"]').setInputFiles(samplePath);
  await page.waitForSelector('a[href^="/app/editor/"]', { timeout: 40_000 });
  check('เอกสารปรากฏในรายการหลังอัปโหลด', true);
  check('แสดงจำนวนหน้าถูกต้อง', (await page.getByText('3 หน้า').count()) > 0);

  // The headline interaction: dropping a file onto the zone, not just picking it.
  const pdfBase64 = (await readFile(samplePath)).toString('base64');
  await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const file = new File([bytes], 'dropped.pdf', { type: 'application/pdf' });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    const zone = [...document.querySelectorAll('div')].find((node) =>
      node.textContent?.includes('ลากไฟล์ PDF มาวางที่นี่') && node.className.includes('border-dashed'),
    );
    zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: transfer }));
    zone.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
  }, pdfBase64);
  await page.waitForFunction(
    () => document.querySelectorAll('a[href^="/app/editor/"]').length === 2,
    { timeout: 40_000 },
  );
  check('ลากไฟล์มาวางในกรอบอัปโหลดได้', true);

  // Remove the dropped copy so the rest of the test works on one document.
  await page.evaluate(() => {
    window.confirm = () => true;
  });
  await page.locator('button[title="ลบ"]').first().click();
  await page.waitForFunction(
    () => document.querySelectorAll('a[href^="/app/editor/"]').length === 1,
    { timeout: 30_000 },
  );
  check('ลบเอกสารจากหน้ารายการได้', true);

  // --- Open the editor ----------------------------------------------------
  console.log('\n[3] เปิดหน้าแก้ไขและเรนเดอร์ PDF');
  await page.click('a[href^="/app/editor/"]');
  await page.waitForURL('**/app/editor/**', { timeout: 30_000 });

  const stage = page.locator('[data-page-index="0"]');
  await stage.waitFor({ state: 'visible', timeout: 40_000 });
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('[data-page-index="0"] canvas');
      return canvas instanceof HTMLCanvasElement && canvas.width > 100;
    },
    { timeout: 60_000 },
  );
  check('เรนเดอร์หน้า PDF ลงแคนวาสได้', true);

  // A blank canvas of the right size is not a rendered page: count the pixels
  // that are not white. This is what caught pdf.js silently failing to render.
  const inkRatio = await page.evaluate(() => {
    const canvas = document.querySelector('[data-page-index="0"] canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let ink = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] < 240 || data[index + 1] < 240 || data[index + 2] < 240) ink += 1;
    }
    return ink / (data.length / 4);
  });
  check(
    `เนื้อหาของ PDF ถูกวาดลงแคนวาสจริง (พิกเซลที่ไม่ใช่สีขาว ${(inkRatio * 100).toFixed(2)}%)`,
    inkRatio > 0.0005,
    `ink ratio ${inkRatio}`,
  );
  check('แสดงจำนวนหน้าในแถบซ้าย', (await page.getByText('หน้า (3/3)').count()) > 0);

  const stageBox = await stage.boundingBox();
  check('หน้าเอกสารมีขนาดตามสัดส่วน A4', Math.abs(stageBox.height / stageBox.width - 841.89 / 595.28) < 0.02);

  // --- Place a text box by clicking --------------------------------------
  console.log('\n[4] วางกล่องข้อความด้วยการคลิก');
  await page.click('button[title^="กล่องข้อความ"]');
  await page.mouse.click(stageBox.x + stageBox.width * 0.4, stageBox.y + stageBox.height * 0.3);
  await page.waitForSelector('[data-element-id]', { timeout: 10_000 });
  check('สร้างองค์ประกอบใหม่สำเร็จ', (await page.locator('[data-element-id]').count()) === 1);
  check(
    'แผงคุณสมบัติแสดงชนิดองค์ประกอบ',
    (await page.getByText('พิมพ์ข้อความที่นี่').count()) > 0,
  );

  async function geometry() {
    return page.evaluate(() => {
      const node = document.querySelector('[data-element-id]');
      return {
        x: Number.parseFloat(node.style.left),
        y: Number.parseFloat(node.style.top),
        w: Number.parseFloat(node.style.width),
        h: Number.parseFloat(node.style.height),
      };
    });
  }

  const placed = await geometry();
  check(
    `วางตรงตำแหน่งที่คลิก (x≈${placed.x.toFixed(0)}, y≈${placed.y.toFixed(0)})`,
    Math.abs(placed.x + placed.w / 2 - 595.28 * 0.4) < 12 &&
      Math.abs(placed.y + placed.h / 2 - 841.89 * 0.3) < 12,
    JSON.stringify(placed),
  );

  // --- Drag ---------------------------------------------------------------
  console.log('\n[5] ลากย้ายองค์ประกอบ');
  const element = page.locator('[data-element-id]').first();
  const elementBox = await element.boundingBox();
  const zoom = elementBox.width / placed.w;

  // Hold Alt so snapping does not perturb the expected delta.
  await page.keyboard.down('Alt');
  await page.mouse.move(elementBox.x + elementBox.width / 2, elementBox.y + elementBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    elementBox.x + elementBox.width / 2 + 90 * zoom,
    elementBox.y + elementBox.height / 2 + 60 * zoom,
    { steps: 12 },
  );
  await page.mouse.up();
  await page.keyboard.up('Alt');

  const dragged = await geometry();
  check(
    `ลากแล้วเลื่อนไปตามระยะที่ลาก (Δx≈${(dragged.x - placed.x).toFixed(1)}, Δy≈${(dragged.y - placed.y).toFixed(1)})`,
    Math.abs(dragged.x - placed.x - 90) < 3 && Math.abs(dragged.y - placed.y - 60) < 3,
    JSON.stringify({ placed, dragged }),
  );

  // --- Resize -------------------------------------------------------------
  console.log('\n[6] ปรับขนาดด้วยจุดจับ');
  const handle = page.locator('.selection-handle').nth(4); // south-east
  const handleBox = await handle.boundingBox();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    handleBox.x + handleBox.width / 2 + 70 * zoom,
    handleBox.y + handleBox.height / 2 + 40 * zoom,
    { steps: 10 },
  );
  await page.mouse.up();

  const resized = await geometry();
  check(
    `ขยายขนาดตามที่ลาก (w ${dragged.w.toFixed(0)}→${resized.w.toFixed(0)}, h ${dragged.h.toFixed(0)}→${resized.h.toFixed(0)})`,
    Math.abs(resized.w - dragged.w - 70) < 4 && Math.abs(resized.h - dragged.h - 40) < 4,
    JSON.stringify({ dragged, resized }),
  );
  check(
    'มุมซ้ายบนคงที่เมื่อลากมุมขวาล่าง',
    Math.abs(resized.x - dragged.x) < 2 && Math.abs(resized.y - dragged.y) < 2,
  );

  // --- Edit text ----------------------------------------------------------
  console.log('\n[7] แก้ไขข้อความและคุณสมบัติ');
  await element.dblclick();
  await page.waitForSelector('[data-element-id] textarea', { timeout: 10_000 });
  await page.keyboard.press('Control+A');
  await page.keyboard.type('สวัสดีจาก MeDF');
  await page.locator('[data-page-index="0"]').click({ position: { x: 10, y: 10 } });
  check(
    'พิมพ์ข้อความภาษาไทยลงกล่องข้อความได้',
    (await page.locator('[data-element-id] .element-text').first().innerText()).includes(
      'สวัสดีจาก MeDF',
    ),
  );

  // --- More element types -------------------------------------------------
  console.log('\n[8] วางองค์ประกอบชนิดอื่น');
  /**
   * The page is taller than the window at fit-to-width zoom, so a click point
   * has to stay inside both the page box and the viewport.
   */
  async function pointOnPage(fractionX, fractionY) {
    const box = await page.locator('[data-page-index="0"]').boundingBox();
    const viewport = page.viewportSize();
    const visibleBottom = Math.min(box.y + box.height, viewport.height - 8);
    const visibleTop = Math.max(box.y, 8);
    return {
      x: box.x + box.width * fractionX,
      y: visibleTop + (visibleBottom - visibleTop) * fractionY,
    };
  }

  for (const [index, title] of ['สี่เหลี่ยม', 'ไฮไลต์', 'เครื่องหมาย', 'เส้น'].entries()) {
    await page.click(`button[title^="${title}"]`);
    const point = await pointOnPage(0.25 + index * 0.12, 0.45 + index * 0.1);
    await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(120);
  }
  check(
    'วางองค์ประกอบได้ครบ 5 ชิ้น',
    (await page.locator('[data-element-id]').count()) === 5,
    String(await page.locator('[data-element-id]').count()),
  );

  // --- Signature ----------------------------------------------------------
  console.log('\n[9] วาดลายเซ็น');
  await page.click('button[title^="ลายเซ็น"]');
  const pad = page.locator('canvas.touch-none');
  await pad.waitFor({ state: 'visible', timeout: 10_000 });
  const padBox = await pad.boundingBox();
  await page.mouse.move(padBox.x + 40, padBox.y + padBox.height * 0.7);
  await page.mouse.down();
  for (let step = 1; step <= 10; step += 1) {
    await page.mouse.move(
      padBox.x + 40 + (padBox.width - 80) * (step / 10),
      padBox.y + padBox.height * (step % 2 === 0 ? 0.3 : 0.75),
    );
  }
  await page.mouse.up();
  await page.click('button:has-text("วางลายเซ็นลงเอกสาร")');
  check('เพิ่มลายเซ็นเป็นองค์ประกอบใหม่', (await page.locator('[data-element-id]').count()) === 6);

  // --- Undo / redo --------------------------------------------------------
  console.log('\n[10] ย้อนกลับและทำซ้ำ');
  await page.keyboard.press('Control+z');
  check('Ctrl+Z ลบองค์ประกอบล่าสุดออก', (await page.locator('[data-element-id]').count()) === 5);
  await page.keyboard.press('Control+Shift+z');
  check('Ctrl+Shift+Z คืนองค์ประกอบกลับมา', (await page.locator('[data-element-id]').count()) === 6);

  // --- Page operations ----------------------------------------------------
  console.log('\n[11] จัดการหน้าเอกสาร');
  await page.click('button[title="หมุนขวา"]');
  await page.waitForTimeout(400);
  const rotatedStage = await page.locator('[data-page-index="0"]').boundingBox();
  check(
    'หมุนหน้าแล้วสลับความกว้าง/สูงบนหน้าจอ',
    rotatedStage.width > rotatedStage.height,
    JSON.stringify(rotatedStage),
  );
  await page.click('button[title="หมุนซ้าย"]');
  await page.waitForTimeout(400);

  await page.click('button[title^="ซ่อนหน้านี้"]');
  check('ซ่อนหน้าได้', (await page.getByText('หน้า (2/3)').count()) > 0);
  await page.click('button[title="แสดงหน้านี้"]');

  // --- Autosave -----------------------------------------------------------
  console.log('\n[12] บันทึกอัตโนมัติ');
  await page.waitForFunction(
    () => document.body.innerText.includes('บันทึกแล้ว'),
    { timeout: 20_000 },
  );
  check('แสดงสถานะบันทึกแล้วหลังแก้ไข', true);

  await page.screenshot({ path: path.join(dataDir, 'editor.png'), fullPage: false });

  // --- Export -------------------------------------------------------------
  console.log('\n[13] Export กลับเป็น PDF');
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 60_000 }),
    page.click('button:has-text("Export PDF")'),
  ]);
  const exportedPath = path.join(dataDir, 'exported.pdf');
  await download.saveAs(exportedPath);
  const exported = await readFile(exportedPath);
  check('ดาวน์โหลดไฟล์ PDF สำเร็จ', exported.byteLength > 1000, `${exported.byteLength} bytes`);

  const text = await extractText(new Uint8Array(exported));
  check('ไฟล์ที่ได้มีข้อความที่พิมพ์ไว้', text.includes('สวัสดีจาก MeDF'), text.slice(0, 300));
  check('ไฟล์ที่ได้ยังมีเนื้อหาต้นฉบับ', text.includes('PAGEMARKER-ONE'));

  // --- Reload keeps the work ---------------------------------------------
  console.log('\n[14] เปิดเอกสารใหม่แล้วงานยังอยู่');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-element-id]', { timeout: 40_000 });
  check(
    'องค์ประกอบทั้งหมดถูกบันทึกไว้จริง',
    (await page.locator('[data-element-id]').count()) === 6,
    String(await page.locator('[data-element-id]').count()),
  );

  // --- Subscription flow --------------------------------------------------
  console.log('\n[15] อัปเกรดแพ็กเกจจากหน้าเว็บ');
  await page.goto(`${BASE}/app/billing`, { waitUntil: 'domcontentloaded' });
  await page.click('div.card:has-text("Pro") >> button:has-text("สมัครแพ็กเกจนี้")');
  await page.waitForSelector('text=เปิดใช้แพ็กเกจ Pro เรียบร้อย', { timeout: 30_000 });
  check('สมัครแพ็กเกจในโหมด sandbox ได้', true);
  await page.waitForTimeout(1200);
  check(
    'แถบนำทางแสดงแพ็กเกจใหม่',
    (await page.getByText('แพ็กเกจ Pro').count()) > 0,
  );

  // --- Open-core: this server has no paid module installed ---------------
  console.log('\n[16] บิลด์โอเพนซอร์สที่ไม่มีโมดูลเสริม');
  // Use the page's own fetch so the member's session cookie is sent.
  const featureReport = await page.evaluate(async () =>
    (await fetch('/api/features')).json(),
  );
  check('รายงานแพ็กเกจของสมาชิกที่เข้าสู่ระบบ', featureReport.plan === 'pro', featureReport.plan);
  check('รายงานว่าไม่ได้ติดตั้งโมดูลเสริม', featureReport.proInstalled === false);
  const proFeatures = featureReport.features.filter((feature) => feature.source === 'private');
  check(
    'ฟีเจอร์เสริมทุกตัวรายงานว่ายังไม่ได้ติดตั้ง',
    proFeatures.length > 0 && proFeatures.every((feature) => feature.reason === 'not_installed'),
    JSON.stringify(proFeatures.map((feature) => feature.reason)),
  );
  const coreFeatures = featureReport.features.filter((feature) => feature.source === 'core');
  check(
    'ฟีเจอร์ของ core ยังใช้งานได้ตามปกติ',
    coreFeatures.some((feature) => feature.available),
  );
  const proStatus = await page.evaluate(async () => {
    const response = await fetch('/api/pro/ocr', { method: 'POST' });
    return { status: response.status, body: await response.json().catch(() => null) };
  });
  check(
    'สมาชิกที่จ่ายเงินแล้วเรียกฟีเจอร์เสริมได้ 501 เมื่อเซิร์ฟเวอร์ไม่ได้ติดตั้ง',
    proStatus.status === 501 && proStatus.body?.code === 'pro_not_installed',
    JSON.stringify(proStatus),
  );

  const ignorable = [/Failed to load resource/i, /favicon/i, /ERR_ABORTED/i, /501/];
  const realErrors = consoleErrors.filter(
    (message) => !ignorable.some((pattern) => pattern.test(message)),
  );
  check('ไม่มี error ใน console ของเบราว์เซอร์', realErrors.length === 0, realErrors.join(' | '));

  if (process.env.MEDF_KEEP_UI_DATA) {
    console.log(`\nไฟล์ผลลัพธ์อยู่ที่: ${dataDir}`);
  }
} catch (error) {
  failed = true;
  console.error(`\n❌ ${error.message}`);
  console.error(error.stack?.split('\n').slice(1, 4).join('\n') ?? '');
  console.error('\n--- server log ---\n' + serverLogs.join('').slice(-2500));
} finally {
  await browser?.close().catch(() => undefined);
  server.kill('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 300));
  if (!process.env.MEDF_KEEP_UI_DATA) await rm(dataDir, { recursive: true, force: true });
}

if (failed) process.exitCode = 1;
else console.log(`\n✅ ผ่านทั้งหมด ${passed} ข้อ`);

/**
 * Resolves a Chromium binary. Playwright's own download is used when present;
 * otherwise we fall back to a browser the environment preinstalled (CI images
 * commonly set `PLAYWRIGHT_BROWSERS_PATH`).
 */
function findChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;
  const candidates = readdirSync(root)
    .filter((name) => name.startsWith('chromium-'))
    .map((name) => path.join(root, name, 'chrome-linux', 'chrome'))
    .filter((candidate) => existsSync(candidate));
  return candidates[0];
}

/** Pulls the text layer out of a PDF with pdf.js. */
async function extractText(bytes) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
  const parts = [];
  for (let index = 1; index <= document.numPages; index += 1) {
    const content = await (await document.getPage(index)).getTextContent();
    parts.push(content.items.map((item) => item.str ?? '').join(''));
  }
  return parts.join('\n');
}
