/**
 * UX/UI audit across every screen, both languages and five window sizes.
 *
 * This is not a pass/fail test like `ui-test.mjs`; it is a survey. It loads
 * each page in a real browser, measures what is actually on screen and writes
 * a report plus a screenshot of every combination, so a human can look at the
 * pictures and a machine can catch the things people stop noticing:
 * sideways scroll, tap targets too small for a thumb, text clipped by its own
 * box, unreadable contrast, controls with no accessible name.
 *
 * The window sizes are not arbitrary. `windows-min` is exactly the smallest
 * the desktop app can be made (`minWidth`/`minHeight` in desktop/src/main.js),
 * which is the size nobody ever tests by hand.
 *
 *   node apps/web/scripts/ux-audit.mjs            ทุกหน้า ทุกขนาด สองภาษา
 *   node apps/web/scripts/ux-audit.mjs --quick    เฉพาะ desktop กับ mobile ภาษาไทย
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  findChromium,
  freePort,
  loadPlaywright,
  startNextServer,
  waitForHttp,
} from '../../../scripts/test-harness.mjs';

const webRoot = path.join(import.meta.dirname, '..');
const outDir = path.join(webRoot, '.ux-audit');
const QUICK = process.argv.includes('--quick');

const PORT = await freePort('AUDIT_PORT');
const BASE = `http://127.0.0.1:${PORT}`;

/**
 * `windows-min` and `windows` mirror the desktop shell's window; the rest are
 * the sizes the web actually gets.
 */
const VIEWPORTS = [
  { id: 'desktop', width: 1440, height: 900, touch: false },
  { id: 'windows', width: 1440, height: 920, touch: false },
  { id: 'windows-min', width: 1024, height: 680, touch: false },
  { id: 'tablet', width: 768, height: 1024, touch: true },
  { id: 'mobile', width: 390, height: 844, touch: true },
  { id: 'mobile-small', width: 360, height: 640, touch: true },
];

const LOCALES = [
  { id: 'th', accept: 'th-TH' },
  { id: 'en', accept: 'en-US' },
];

/**
 * Every key in the dictionary, so a label rendering its key instead of its
 * text can be recognised exactly rather than guessed at by shape.
 */
const MESSAGE_KEYS = [
  ...(await readFile(path.join(webRoot, 'src', 'lib', 'i18n', 'th.ts'), 'utf8')).matchAll(
    /^\s*'([a-zA-Z0-9.]+)':/gm,
  ),
].map((match) => match[1]);

const chosenViewports = QUICK
  ? VIEWPORTS.filter((viewport) => viewport.id === 'desktop' || viewport.id === 'mobile')
  : VIEWPORTS;
const chosenLocales = QUICK ? LOCALES.slice(0, 1) : LOCALES;

/**
 * Everything measured inside the page. Returned as plain data so the report
 * can group it; nothing here throws, because one bad page must not stop the
 * survey.
 */
function inspect(messageKeys) {
  const findings = [];
  const keys = new Set(messageKeys);
  const seen = new Set();

  function describe(element) {
    if (!element || element === document.documentElement) return 'html';
    const id = element.id ? `#${element.id}` : '';
    const cls = typeof element.className === 'string' && element.className
      ? `.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}`
      : '';
    const text = (element.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return `${element.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ''}`;
  }

  function add(kind, detail, element) {
    const where = describe(element);
    const key = `${kind}|${where}|${detail}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ kind, detail, where });
  }

  const visible = (element) => {
    // `inert` and `aria-hidden` say "this is not here"; taking the page at its
    // word is the difference between a finding and a false alarm.
    if (element.closest('[inert], [aria-hidden="true"]')) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  const all = [...document.querySelectorAll('body *')];

  // --- 1. Sideways scroll ---------------------------------------------------
  // The single most common mobile defect, and always someone's fixed width.
  const limit = document.documentElement.clientWidth;
  if (document.documentElement.scrollWidth > limit + 1) {
    const over = all.filter((element) => {
      if (!visible(element)) return false;
      if (getComputedStyle(element).position === 'fixed') return false;
      return element.getBoundingClientRect().right > limit + 1;
    });
    // Report the innermost offenders: an overflowing wrapper is usually just
    // reporting on its child.
    const leaves = over.filter((element) => !over.some((other) => other !== element && element.contains(other)));
    add('overflow-x', `หน้ากว้าง ${document.documentElement.scrollWidth}px เกิน ${limit}px`, document.body);
    for (const element of leaves.slice(0, 6)) {
      const rect = element.getBoundingClientRect();
      add('overflow-x', `ล้นขอบขวา ${Math.round(rect.right - limit)}px`, element);
    }
  }

  // --- 2. Tap targets -------------------------------------------------------
  // Only on a touch viewport: an 18px link is fine under a mouse pointer and
  // reporting it everywhere would bury the sizes that actually matter.
  const touch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const interactive = touch ? all.filter(
    (element) =>
      visible(element) &&
      (element.matches('a[href], button, input:not([type=hidden]), select, textarea, [role="button"], [tabindex]:not([tabindex="-1"])')),
  ) : [];
  for (const element of interactive) {
    const rect = element.getBoundingClientRect();
    // An inline link inside a paragraph is exempt: WCAG 2.5.8 excludes targets
    // that are part of a sentence, and padding them would break the text.
    const inSentence =
      element.tagName === 'A' &&
      element.parentElement &&
      getComputedStyle(element).display.startsWith('inline') &&
      (element.parentElement.textContent ?? '').trim().length > (element.textContent ?? '').trim().length + 12;
    if (inSentence) continue;

    const size = Math.min(rect.width, rect.height);
    if (size < 24) add('tap-target-fail', `${Math.round(rect.width)}×${Math.round(rect.height)}px (ต่ำกว่า 24px)`, element);
    else if (size < 44) add('tap-target-warn', `${Math.round(rect.width)}×${Math.round(rect.height)}px (ต่ำกว่า 44px)`, element);
  }

  // --- 2b. Controls pushed off the screen -----------------------------------
  // The editor toolbar wanted 472px inside a 390px window and simply clipped:
  // Export and the properties button sat past the edge with nothing to scroll.
  // A control outside the window is only fine when something can scroll to it.
  const scrollable = (element) => {
    for (let node = element.parentElement; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      const scrolls = /auto|scroll/.test(`${style.overflowX} ${style.overflowY}`);
      if (scrolls && (node.scrollWidth > node.clientWidth || node.scrollHeight > node.clientHeight)) {
        return true;
      }
    }
    return false;
  };

  const controls = all.filter(
    (element) =>
      visible(element) &&
      element.matches('a[href], button, input:not([type=hidden]), select, textarea, [role="button"]'),
  );
  for (const element of controls) {
    const rect = element.getBoundingClientRect();
    const past = rect.right > window.innerWidth + 1 || rect.left < -1;
    if (!past) continue;
    if (scrollable(element)) continue;
    add(
      'unreachable',
      `อยู่นอกขอบจอ (x ${Math.round(rect.left)}–${Math.round(rect.right)} จาก ${window.innerWidth}px) และเลื่อนไปหาไม่ได้`,
      element,
    );
  }

  // --- 3. Contrast ----------------------------------------------------------
  /**
   * Any CSS colour as sRGB bytes, by painting it and reading the pixel back.
   *
   * A regex over `rgb(...)` is not enough: Tailwind v4 emits `lab()` and
   * `oklch()`, and a parser that quietly returns null for those skips exactly
   * the elements it was written to check. The canvas knows every colour space
   * the browser does.
   */
  const swatch = document.createElement('canvas');
  swatch.width = 1;
  swatch.height = 1;
  const brush = swatch.getContext('2d', { willReadFrequently: true });
  const parsed = new Map();

  function parse(colour) {
    if (parsed.has(colour)) return parsed.get(colour);
    let result = null;
    try {
      brush.clearRect(0, 0, 1, 1);
      brush.fillStyle = '#000000';
      brush.fillStyle = colour;
      // An unsupported value leaves `fillStyle` at the previous one; a real
      // black stays black, which is harmless.
      brush.clearRect(0, 0, 1, 1);
      brush.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = brush.getImageData(0, 0, 1, 1).data;
      result = { r, g, b, a: a / 255 };
    } catch {
      result = null;
    }
    parsed.set(colour, result);
    return result;
  }

  function luminance({ r, g, b }) {
    const channel = (value) => {
      const v = value / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }

  /** Walks up for the first opaque background; gives up on an image. */
  function backdrop(element) {
    let node = element;
    while (node && node !== document.documentElement) {
      const style = getComputedStyle(node);
      if (style.backgroundImage !== 'none') return null;
      const colour = parse(style.backgroundColor);
      if (colour && colour.a === 1) return colour;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  }

  const withText = all.filter((element) => {
    if (!visible(element)) return false;
    return [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim().length > 1);
  });

  for (const element of withText) {
    const style = getComputedStyle(element);
    const front = parse(style.color);
    const back = backdrop(element);
    if (!front || !back || front.a < 0.95) continue;

    const size = Number.parseFloat(style.fontSize);
    const bold = Number(style.fontWeight) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const lighter = Math.max(luminance(front), luminance(back));
    const darker = Math.min(luminance(front), luminance(back));
    const ratio = (lighter + 0.05) / (darker + 0.05);
    const required = large ? 3 : 4.5;
    if (ratio < required) {
      add(
        'contrast',
        `${ratio.toFixed(2)}:1 ต้องการ ${required}:1 (${style.color} บน rgb(${back.r},${back.g},${back.b}), ${style.fontSize})`,
        element,
      );
    }
  }

  // --- 4. Accessible names --------------------------------------------------
  const named = (element) => {
    if (element.getAttribute('aria-label')?.trim()) return true;
    if (element.getAttribute('aria-labelledby')?.trim()) return true;
    if (element.getAttribute('title')?.trim()) return true;
    if ((element.textContent ?? '').trim()) return true;
    const image = element.querySelector('img[alt]:not([alt=""])');
    if (image) return true;
    return false;
  };

  for (const element of all) {
    if (!visible(element)) continue;
    if (element.matches('img') && element.getAttribute('alt') === null) {
      add('no-alt', 'ไม่มี alt (ถ้าเป็นภาพตกแต่งให้ใส่ alt="")', element);
    }
    if (element.matches('a[href], button, [role="button"]') && !named(element)) {
      add('no-name', 'ปุ่ม/ลิงก์ไม่มีชื่อที่ screen reader อ่านได้', element);
    }
    if (element.matches('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea')) {
      const labelled =
        element.labels?.length > 0 ||
        element.getAttribute('aria-label')?.trim() ||
        element.getAttribute('aria-labelledby')?.trim() ||
        element.getAttribute('title')?.trim();
      if (!labelled) add('no-label', `ช่องกรอกไม่มี label (placeholder ไม่นับ)`, element);
    }
  }

  // --- 5. Text clipped by its own box --------------------------------------
  for (const element of withText) {
    const style = getComputedStyle(element);
    const clips = style.overflow === 'hidden' || style.overflowX === 'hidden';
    if (!clips) continue;
    // The visually-hidden pattern is a 1px box whose text is meant to escape it.
    if (element.clientWidth <= 1 || style.clipPath !== 'none' || style.position === 'absolute' && element.clientHeight <= 1) continue;
    if (style.textOverflow === 'ellipsis') continue;
    if (element.scrollWidth > element.clientWidth + 1) {
      add('clipped', `ข้อความกว้าง ${element.scrollWidth}px ในกล่อง ${element.clientWidth}px`, element);
    }
  }

  // --- 6. Message keys that reached the screen ------------------------------
  // `t()` on the tooltip and not on the label renders "element.text" where a
  // word belongs. It reads as a typo in review and as a bug to a member, and
  // no dictionary test can see it: the key really does exist.
  for (const element of all) {
    if (!visible(element)) continue;
    for (const node of element.childNodes) {
      if (node.nodeType !== 3) continue;
      const text = node.textContent.trim();
      if (text && keys.has(text)) add('untranslated', `แสดงชื่อ key แทนข้อความ: "${text}"`, element);
    }
  }

  // --- 7. Structure ---------------------------------------------------------
  const ids = new Map();
  for (const element of all) {
    if (!element.id) continue;
    ids.set(element.id, (ids.get(element.id) ?? 0) + 1);
  }
  for (const [id, count] of ids) if (count > 1) add('duplicate-id', `id="${id}" ซ้ำ ${count} ครั้ง`, document.body);

  const headings = all.filter((element) => /^H[1-6]$/.test(element.tagName) && visible(element));
  const h1 = headings.filter((element) => element.tagName === 'H1');
  if (h1.length === 0) add('heading', 'ไม่มี <h1> ในหน้านี้', document.body);
  if (h1.length > 1) add('heading', `มี <h1> ${h1.length} ตัว`, document.body);
  let previous = 0;
  for (const heading of headings) {
    const level = Number(heading.tagName[1]);
    if (previous && level > previous + 1) {
      add('heading', `ข้ามระดับหัวข้อ h${previous} → h${level}`, heading);
    }
    previous = level;
  }

  return {
    findings,
    lang: document.documentElement.lang,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  };
}

// --- Drive ------------------------------------------------------------------

const dataDir = await mkdtemp(path.join(tmpdir(), 'medf-ux-'));
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const server = startNextServer({
  cwd: webRoot,
  port: PORT,
  env: {
    MEDF_DATA_DIR: dataDir,
    MEDF_SESSION_SECRET: 'ux-audit-secret-ux-audit-secret-ux-a',
    MEDF_BILLING_SANDBOX: '1',
    MEDF_APP_URL: BASE,
  },
});

const report = [];
let browser;

try {
  await waitForHttp(`${BASE}/api/health`, { server });

  // A member with one document, so the editor and the list have something in
  // them: an empty screen hides most of the layout problems worth finding.
  const PAGES = [
    { id: 'landing', url: '/', auth: false },
    { id: 'pricing', url: '/pricing', auth: false },
    { id: 'editor', url: '/try', auth: false, settle: 5000 },
  ];

  const { chromium } = loadPlaywright();
  browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
    executablePath: findChromium(),
  });

  for (const locale of chosenLocales) {
    for (const viewport of chosenViewports) {
      const shape = {
        locale: locale.accept,
        viewport: { width: viewport.width, height: viewport.height },
        hasTouch: viewport.touch,
        isMobile: viewport.touch,
        deviceScaleFactor: 1,
      };
      const context = await browser.newContext(shape);

      for (const target of PAGES) {
        const page = await context.newPage();
        const console_ = [];
        page.on('console', (message) => {
          if (message.type() === 'error') console_.push(message.text().slice(0, 200));
        });
        page.on('pageerror', (error) => console_.push(`pageerror: ${String(error).slice(0, 200)}`));
        // A 404 on an asset never reaches `console` with a useful name; this
        // is the only way to learn *which* file the page could not load.
        page.on('response', (response) => {
          if (response.status() >= 400) console_.push(`HTTP ${response.status()} ${response.url().replace(BASE, '')}`);
        });

        const label = `${locale.id}/${viewport.id}/${target.id}`;
        try {
          await page.goto(`${BASE}${target.url}`, { waitUntil: 'networkidle', timeout: 45_000 });
          await page.waitForTimeout(target.settle ?? 700);

          const result = await page.evaluate(inspect, MESSAGE_KEYS);
          const shot = path.join(outDir, `${locale.id}__${viewport.id}__${target.id}.png`);
          await page.screenshot({ path: shot, fullPage: true });

          report.push({
            locale: locale.id,
            viewport: viewport.id,
            page: target.id,
            url: target.url,
            touch: viewport.touch,
            lang: result.lang,
            findings: result.findings,
            console: console_,
            screenshot: path.relative(webRoot, shot),
          });
          const errors = result.findings.filter((f) => f.kind !== 'tap-target-warn').length;
          process.stdout.write(`${errors === 0 && console_.length === 0 ? '  ✓' : '  •'} ${label} (${result.findings.length} ข้อสังเกต)\n`);
        } catch (error) {
          report.push({
            locale: locale.id,
            viewport: viewport.id,
            page: target.id,
            url: target.url,
            touch: viewport.touch,
            findings: [{ kind: 'load-failed', detail: String(error?.message ?? error).slice(0, 300), where: 'page' }],
            console: console_,
          });
          process.stdout.write(`  ✗ ${label}: ${String(error?.message ?? error).slice(0, 120)}\n`);
        }
        await page.close();
      }

      await context.close();
    }
  }
} finally {
  await browser?.close().catch(() => undefined);
  server.stop();
  await rm(dataDir, { recursive: true, force: true });
}

await writeFile(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');

// --- Summary ----------------------------------------------------------------

/**
 * What fails the run rather than merely being reported.
 *
 * `tap-target-warn` is the 44px recommendation and stays advisory: plenty of
 * the controls below it are fine under a mouse. Everything here is a defect
 * with an owner — a key on screen, unreadable text, a page that scrolls
 * sideways, invalid markup, a control too small for a finger.
 */
const FAIL_KINDS = new Set([
  'untranslated',
  'unreachable',
  'contrast',
  'overflow-x',
  'tap-target-fail',
  'duplicate-id',
  'no-alt',
  'no-name',
  'no-label',
  'clipped',
  'heading',
  'load-failed',
]);

const byKind = new Map();
for (const entry of report) {
  for (const finding of entry.findings) {
    const key = `${finding.kind}`;
    if (!byKind.has(key)) byKind.set(key, []);
    byKind.get(key).push({ ...finding, at: `${entry.locale}/${entry.viewport}/${entry.page}` });
  }
}

const lines = ['', '=== สรุป ==='];
for (const [kind, items] of [...byKind].sort((a, b) => b[1].length - a[1].length)) {
  const places = new Set(items.map((item) => item.at));
  lines.push(`${kind.padEnd(18)} ${String(items.length).padStart(4)} ครั้ง · ${places.size} หน้า/ขนาด`);
  const unique = new Map();
  for (const item of items) {
    if (!unique.has(item.where)) unique.set(item.where, item);
  }
  for (const item of [...unique.values()].slice(0, 5)) {
    lines.push(`    ${item.at}  ${item.where}  — ${item.detail}`);
  }
  if (unique.size > 5) lines.push(`    … อีก ${unique.size - 5} จุด`);
}
const consoleErrors = report.flatMap((entry) => entry.console.map((text) => `${entry.locale}/${entry.viewport}/${entry.page}: ${text}`));
if (consoleErrors.length) {
  lines.push(`console errors      ${consoleErrors.length} ครั้ง`);
  for (const text of [...new Set(consoleErrors)].slice(0, 8)) lines.push(`    ${text}`);
}
lines.push('', `รายงานเต็ม: ${path.relative(process.cwd(), path.join(outDir, 'report.json'))}`);
lines.push(`ภาพหน้าจอ: ${path.relative(process.cwd(), outDir)}`);

const failures = [...byKind].filter(([kind]) => FAIL_KINDS.has(kind));
const failureCount = failures.reduce((total, [, items]) => total + items.length, 0);
const advisory = [...byKind]
  .filter(([kind]) => !FAIL_KINDS.has(kind))
  .reduce((total, [, items]) => total + items.length, 0);

lines.push('');
if (failureCount || consoleErrors.length) {
  lines.push(
    `❌ ตรวจ UX/UI: ${failureCount} ข้อที่ต้องแก้` +
      `${consoleErrors.length ? ` · error ในคอนโซล ${consoleErrors.length} ครั้ง` : ''}` +
      `${advisory ? ` (อีก ${advisory} ข้อเป็นคำแนะนำ)` : ''}`,
  );
  process.exitCode = 1;
} else {
  lines.push(`✅ ตรวจ UX/UI: ผ่าน${advisory ? ` (มีคำแนะนำ ${advisory} ข้อ)` : ''}`);
}
console.log(lines.join('\n'));
