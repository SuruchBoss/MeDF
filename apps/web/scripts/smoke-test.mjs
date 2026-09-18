/**
 * End-to-end smoke test.
 *
 * Boots the built server against a throwaway data directory and drives the
 * real HTTP API: register, upload, edit, export, then verifies the exported
 * PDF with pdf.js — including that element geometry lands where the editor put
 * it, for both upright and intrinsically rotated pages.
 *
 * Usage: node scripts/smoke-test.mjs   (run `next build` first)
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  Session as HarnessSession,
  createChecker,
  freePort,
  startNextServer,
  waitForHttp,
} from '../../../scripts/test-harness.mjs';
import { makeSamplePdf } from './make-sample-pdf.mjs';

/**
 * The Next.js app directory, resolved from this file rather than from the
 * caller's working directory — these scripts are run from the repository root
 * (`npm run test:api`) as well as from `apps/web`.
 */
const webRoot = path.join(import.meta.dirname, '..');

const PORT = await freePort('SMOKE_PORT');
const BASE = `http://127.0.0.1:${PORT}`;
const PASSWORD = 'SuperSecret123';

/**
 * Fail fast here: each step builds on the last (register, then upload, then
 * edit, then export), so carrying on past a failure only produces noise.
 */
const checker = createChecker({ failFast: true, name: 'ทดสอบ API' });
const check = checker.check;

/** The cookie jar, pre-bound to this run's base URL. */
class Session extends HarnessSession {
  constructor() {
    super(BASE);
  }
}

/** A plain request with no cookie jar, for pages that need no session. */
function anonymousFetch(url, init) {
  return fetch(`${BASE}${url}`, { ...init, redirect: 'manual' });
}

async function main() {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'medf-smoke-'));

  // A stand-in for the private paid module, so the open-core gate is exercised
  // without this repository containing any paid-tier code.
  const proModulePath = path.join(dataDir, 'pro-module.cjs');
  await writeFile(
    proModulePath,
    `module.exports = {
      id: 'smoke-pro',
      version: '1.0.0',
      features: ['pro.ocr', 'pro.templates'],
      server: {
        async transformExport(bytes) {
          globalThis.__smokeTransformCalls = (globalThis.__smokeTransformCalls ?? 0) + 1;
          return bytes;
        },
        handlers: {
          ocr: {
            feature: 'pro.ocr',
            async handle(request, user) {
              return Response.json({ ok: true, member: user.id });
            },
          },
          templates: {
            feature: 'pro.templates',
            async handle() {
              return Response.json({ ok: true });
            },
          },
        },
      },
    };`,
  );

  const sample = await makeSamplePdf();
  const samplePath = path.join(dataDir, 'sample.pdf');
  await writeFile(samplePath, sample);

  const server = startNextServer({
    cwd: webRoot,
    port: PORT,
    env: {
      MEDF_DATA_DIR: dataDir,
      MEDF_SESSION_SECRET: 'smoke-test-secret-smoke-test-secret',
      MEDF_BILLING_SANDBOX: '1',
      MEDF_APP_URL: BASE,
      MEDF_PRO_MODULE: proModulePath,
    },
  });

  try {
    const health = await (await waitForHttp(`${BASE}/api/health`, { server })).json();
    console.log('\n[1] เซิร์ฟเวอร์และสถานะระบบ');
    check('GET /api/health ตอบ ok', health.ok === true);
    check('เริ่มต้นด้วยฐานข้อมูลว่าง', health.members === 0, JSON.stringify(health));
    check('ระบบชำระเงินอยู่ในโหมด sandbox', health.billing === 'sandbox');

    // A missing page must be the app's own Thai 404, not Next's English
    // default — and it must still answer 404 so crawlers agree.
    const missing = await anonymousFetch('/no-such-page');
    const missingHtml = await missing.text();
    check('หน้าที่ไม่มีอยู่ตอบสถานะ 404', missing.status === 404);
    check('หน้า 404 เป็นหน้าของแอปเอง', missingHtml.includes('ไม่พบหน้าที่ต้องการ'));
    check('หน้า 404 มีทางกลับ', missingHtml.includes('กลับหน้าแรก'));

    // Errors are thrown deep in lib/ with a message key, not a sentence — this
    // is what proves the key survives all the way out as the caller's language.
    const thaiError = await anonymousFetch('/api/documents');
    const thaiBody = await thaiError.json();
    check('ข้อความ error เป็นภาษาไทยโดยค่าเริ่มต้น', thaiBody.error === 'กรุณาเข้าสู่ระบบ', thaiBody.error);

    const englishError = await anonymousFetch('/api/documents', {
      headers: { 'accept-language': 'en-GB,en;q=0.9' },
    });
    const englishBody = await englishError.json();
    check('ข้อความ error เป็นภาษาอังกฤษเมื่อ Accept-Language บอกว่า en',
      englishBody.error === 'Please sign in.', englishBody.error);

    // Quality values decide, not the order the browser happened to send them.
    const thaiPreferred = await anonymousFetch('/api/documents', {
      headers: { 'accept-language': 'en;q=0.8, th;q=1.0' },
    });
    check('Accept-Language ที่ให้น้ำหนักไทยสูงกว่า ได้ภาษาไทย',
      (await thaiPreferred.json()).error === 'กรุณาเข้าสู่ระบบ');

    // The cookie is an explicit choice and outranks the browser's preference.
    const cookieWins = await anonymousFetch('/api/documents', {
      headers: { 'accept-language': 'th-TH', cookie: 'medf_locale=en' },
    });
    check('คุกกี้ภาษาชนะ Accept-Language', (await cookieWins.json()).error === 'Please sign in.');

    // --- Auth ---------------------------------------------------------------
    console.log('\n[2] ระบบสมาชิก');
    const alice = new Session();
    const anonymous = new Session();

    const unauthorized = await anonymous.json('/api/documents');
    check('ผู้ไม่ได้เข้าสู่ระบบเข้าถึง /api/documents ไม่ได้', unauthorized.status === 401);

    const weak = await alice.json('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', email: 'alice@example.com', password: 'short' }),
    });
    check('ปฏิเสธรหัสผ่านที่สั้นเกินไป', weak.status === 422, JSON.stringify(weak.body));

    const registered = await alice.json('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', email: 'alice@example.com', password: PASSWORD }),
    });
    check('สมัครสมาชิกสำเร็จ', registered.status === 201, JSON.stringify(registered.body));
    check('สมาชิกคนแรกได้สิทธิ์ admin', registered.body.user.role === 'admin');
    check('สมาชิกใหม่เริ่มที่แพ็กเกจ free', registered.body.user.plan === 'free');

    const duplicate = await new Session().json('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice 2', email: 'ALICE@example.com', password: PASSWORD }),
    });
    check('อีเมลซ้ำ (ไม่สนตัวพิมพ์) ถูกปฏิเสธ', duplicate.status === 409);

    const me = await alice.json('/api/auth/me');
    check('GET /api/auth/me คืนข้อมูลสมาชิก', me.body.user?.email === 'alice@example.com');
    check('คืนสรุปโควตามาด้วย', me.body.usage?.maxDocuments === 3, JSON.stringify(me.body.usage));

    const badLogin = await new Session().json('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'WrongPassword1' }),
    });
    check('รหัสผ่านผิดถูกปฏิเสธ', badLogin.status === 401);

    // --- Upload -------------------------------------------------------------
    console.log('\n[3] อัปโหลดและอ่านโครงสร้าง PDF');
    async function upload(session, name = 'สัญญาทดสอบ.pdf') {
      const form = new FormData();
      form.append('file', new File([sample], name, { type: 'application/pdf' }));
      return session.json('/api/documents', { method: 'POST', body: form });
    }

    const notPdf = new FormData();
    notPdf.append('file', new File([new Uint8Array([1, 2, 3])], 'x.txt', { type: 'text/plain' }));
    const rejected = await alice.json('/api/documents', { method: 'POST', body: notPdf });
    check('ไฟล์ที่ไม่ใช่ PDF ถูกปฏิเสธ', rejected.status === 415);

    const created = await upload(alice);
    check('อัปโหลด PDF สำเร็จ', created.status === 201, JSON.stringify(created.body));
    const documentId = created.body.document.id;
    check('นับจำนวนหน้าได้ถูกต้อง', created.body.document.pageCount === 3);

    const loaded = await alice.json(`/api/documents/${documentId}`);
    const overlay = loaded.body.overlay;
    check('overlay มี 3 หน้า', overlay.pages.length === 3);
    check(
      'หน้าที่ไม่หมุนมีขนาด A4 ตั้ง',
      Math.round(overlay.pages[0].width) === 595 && Math.round(overlay.pages[0].height) === 842,
      JSON.stringify(overlay.pages[0]),
    );
    check(
      'หน้าที่หมุน 90° สลับความกว้าง/สูงให้แล้ว',
      Math.round(overlay.pages[1].width) === 842 && Math.round(overlay.pages[1].height) === 595,
      JSON.stringify(overlay.pages[1]),
    );

    const otherFile = await anonymous.fetch(`/api/documents/${documentId}/file`);
    check('คนอื่นเปิดไฟล์ต้นฉบับไม่ได้', otherFile.status === 401);

    const pdfFile = await alice.fetch(`/api/documents/${documentId}/file`);
    check(
      'เจ้าของดาวน์โหลดไฟล์ต้นฉบับได้',
      pdfFile.status === 200 && pdfFile.headers.get('content-type') === 'application/pdf',
    );

    // --- Image asset --------------------------------------------------------
    console.log('\n[4] อัปโหลดรูปภาพสำหรับวางในเอกสาร');
    const pngBytes = makeRedPng();
    const imageForm = new FormData();
    imageForm.append('file', new File([pngBytes], 'stamp.png', { type: 'image/png' }));
    imageForm.append('width', '64');
    imageForm.append('height', '64');
    const asset = await alice.json(`/api/documents/${documentId}/assets`, {
      method: 'POST',
      body: imageForm,
    });
    check('อัปโหลดรูปภาพสำเร็จ', asset.status === 201, JSON.stringify(asset.body));
    const assetId = asset.body.asset.id;

    const assetFetch = await alice.fetch(`/api/assets/${assetId}`);
    check('โหลดรูปภาพกลับมาได้', assetFetch.status === 200);

    // --- Edit ---------------------------------------------------------------
    console.log('\n[5] บันทึกการแก้ไข (overlay)');
    const THAI_TEXT = 'ทดสอบข้อความภาษาไทย';
    const LATIN_TEXT = 'Geometry probe';

    const edited = {
      version: 1,
      pages: overlay.pages,
      elements: [
        {
          id: 'el_text_upright',
          type: 'text',
          page: 0,
          x: 100,
          y: 200,
          w: 300,
          h: 40,
          rotation: 0,
          opacity: 1,
          locked: false,
          text: LATIN_TEXT,
          fontFamily: 'helvetica',
          fontSize: 20,
          bold: false,
          italic: false,
          underline: false,
          color: '#111827',
          align: 'left',
          lineHeight: 1.2,
          background: null,
          padding: 0,
        },
        {
          id: 'el_text_thai',
          type: 'text',
          page: 0,
          x: 60,
          y: 400,
          w: 400,
          h: 60,
          rotation: 0,
          opacity: 1,
          locked: false,
          text: THAI_TEXT,
          fontFamily: 'sarabun',
          fontSize: 18,
          bold: true,
          italic: false,
          underline: true,
          color: '#1d4ed8',
          align: 'left',
          lineHeight: 1.35,
          background: '#fef9c3',
          padding: 4,
        },
        {
          id: 'el_text_rotated_page',
          type: 'text',
          page: 1,
          x: 120,
          y: 90,
          w: 320,
          h: 40,
          rotation: 0,
          opacity: 1,
          locked: false,
          text: 'ROTATEDPAGEPROBE',
          fontFamily: 'helvetica',
          fontSize: 20,
          bold: false,
          italic: false,
          underline: false,
          color: '#000000',
          align: 'left',
          lineHeight: 1.2,
          background: null,
          padding: 0,
        },
        {
          id: 'el_image',
          type: 'image',
          page: 0,
          x: 400,
          y: 600,
          w: 120,
          h: 120,
          rotation: 12,
          opacity: 0.9,
          locked: false,
          assetId,
          naturalRatio: 1,
        },
        {
          id: 'el_rect',
          type: 'rect',
          page: 0,
          x: 60,
          y: 500,
          w: 200,
          h: 80,
          rotation: 0,
          opacity: 1,
          locked: false,
          fill: '#ffffff',
          stroke: '#4f46e5',
          strokeWidth: 2,
          radius: 8,
        },
        {
          id: 'el_ellipse',
          type: 'ellipse',
          page: 0,
          x: 300,
          y: 500,
          w: 90,
          h: 90,
          rotation: 0,
          opacity: 1,
          locked: false,
          fill: null,
          stroke: '#dc2626',
          strokeWidth: 2,
        },
        {
          id: 'el_line',
          type: 'line',
          page: 0,
          x: 60,
          y: 620,
          w: 220,
          h: 30,
          rotation: 0,
          opacity: 1,
          locked: false,
          stroke: '#111827',
          strokeWidth: 2,
          arrowStart: false,
          arrowEnd: true,
          from: [0, 0.5],
          to: [1, 0.5],
        },
        {
          id: 'el_sign',
          type: 'draw',
          page: 2,
          x: 80,
          y: 700,
          w: 220,
          h: 70,
          rotation: 0,
          opacity: 1,
          locked: false,
          strokes: [
            [
              [0, 0.8],
              [0.2, 0.2],
              [0.45, 0.85],
              [0.7, 0.15],
              [1, 0.6],
            ],
          ],
          stroke: '#1d4ed8',
          strokeWidth: 2.4,
        },
        {
          id: 'el_highlight',
          type: 'highlight',
          page: 0,
          x: 60,
          y: 745,
          w: 220,
          h: 24,
          rotation: 0,
          opacity: 0.55,
          locked: false,
          color: '#fde047',
        },
        {
          id: 'el_check',
          type: 'check',
          page: 2,
          x: 500,
          y: 100,
          w: 34,
          h: 34,
          rotation: 0,
          opacity: 1,
          locked: false,
          variant: 'check',
          color: '#16a34a',
          strokeWidth: 3,
        },
      ],
    };

    const saved = await alice.json(`/api/documents/${documentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overlay: edited, baseRevision: created.body.document.revision }),
    });
    check('บันทึก overlay สำเร็จ', saved.status === 200, JSON.stringify(saved.body));
    check('นับจำนวนองค์ประกอบได้ถูกต้อง', saved.body.document.elementCount === 10);
    check('เลข revision เพิ่มขึ้น', saved.body.document.revision === created.body.document.revision + 1);

    const stale = await alice.json(`/api/documents/${documentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overlay: edited, baseRevision: 1 }),
    });
    check('ตรวจจับการแก้ไขซ้อน (revision conflict)', stale.status === 409, JSON.stringify(stale.body));

    const invalid = await alice.json(`/api/documents/${documentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        overlay: { version: 1, pages: overlay.pages, elements: [{ id: 'x', type: 'text' }] },
      }),
    });
    check('overlay ที่ข้อมูลไม่ครบถูกปฏิเสธ', invalid.status === 422);

    // --- Export -------------------------------------------------------------
    console.log('\n[6] Export กลับเป็น PDF และตรวจผลลัพธ์');
    const exportResponse = await alice.fetch(`/api/documents/${documentId}/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ save: false }),
    });
    check('export สำเร็จ', exportResponse.status === 200, await exportResponse.clone().text());
    check(
      'ส่งไฟล์กลับเป็น application/pdf',
      exportResponse.headers.get('content-type') === 'application/pdf',
    );
    check('ไม่มีรูปภาพที่โหลดไม่ได้', exportResponse.headers.get('x-medf-skipped-assets') === '0');

    const exported = new Uint8Array(await exportResponse.arrayBuffer());
    check('ไฟล์ที่ได้ใหญ่กว่าต้นฉบับ (มีฟอนต์และรูปฝังอยู่)', exported.byteLength > sample.byteLength);
    await writeFile(path.join(dataDir, 'exported.pdf'), exported);

    const inspected = await inspectPdf(exported);
    check('ไฟล์ที่ได้มี 3 หน้า', inspected.pageCount === 3, String(inspected.pageCount));

    const allText = inspected.pages.map((page) => page.text).join(' | ');
    check('ข้อความต้นฉบับยังอยู่ (ไม่ถูกแปลงเป็นรูป)', allText.includes('PAGEMARKER-ONE'), allText);
    check('ข้อความที่เพิ่มใหม่อยู่ในไฟล์', allText.includes('Geometry probe'), allText);
    check('ข้อความภาษาไทยอยู่ในไฟล์และอ่านกลับได้', allText.includes(THAI_TEXT), allText);
    check('มีรูปภาพฝังอยู่ในไฟล์', inspected.pages[0].hasImage);

    // Geometry: pdf.js maps the text back to display space independently of
    // our own matrix code, so this catches sign and rotation mistakes.
    const upright = inspected.pages[0].items.find((item) => item.text.includes('Geometry'));
    check('พบข้อความที่ใช้วัดพิกัดในหน้าแรก', Boolean(upright));
    check(
      `ตำแหน่ง X ของข้อความตรงกับที่วาง (คาด 100, ได้ ${upright?.displayX.toFixed(1)})`,
      Math.abs(upright.displayX - 100) < 2,
    );
    check(
      `ตำแหน่ง Y ของข้อความตรงกับที่วาง (คาด ~200-224, ได้ ${upright?.displayY.toFixed(1)})`,
      upright.displayY > 200 && upright.displayY < 200 + 20 * 1.2 + 2,
    );

    const rotatedProbe = inspected.pages[1].items.find((item) => item.text.includes('ROTATEDPAGE'));
    check('พบข้อความในหน้าที่หมุน 90°', Boolean(rotatedProbe), inspected.pages[1].text);
    check(
      `หน้าที่หมุนแล้ว: X ตรงกับที่วาง (คาด 120, ได้ ${rotatedProbe?.displayX.toFixed(1)})`,
      Math.abs(rotatedProbe.displayX - 120) < 2,
    );
    check(
      `หน้าที่หมุนแล้ว: Y ตรงกับที่วาง (คาด ~90-114, ได้ ${rotatedProbe?.displayY.toFixed(1)})`,
      rotatedProbe.displayY > 90 && rotatedProbe.displayY < 90 + 20 * 1.2 + 2,
    );
    check(
      'ขนาดหน้าที่ export ตรงกับที่แสดงในโปรแกรม',
      Math.round(inspected.pages[1].displayWidth) === 842 &&
        Math.round(inspected.pages[1].displayHeight) === 595,
      JSON.stringify(inspected.pages[1]),
    );

    check(
      'แพ็กเกจ free ใส่ลายน้ำให้',
      inspected.pages[0].text.includes('MeDF'),
      inspected.pages[0].text,
    );

    // --- Page operations ----------------------------------------------------
    console.log('\n[7] จัดการหน้า: สลับลำดับ หมุน และซ่อน');
    const reordered = {
      ...edited,
      pages: [
        { ...overlay.pages[2], rotation: 0, hidden: false },
        { ...overlay.pages[0], rotation: 90, hidden: false },
        { ...overlay.pages[1], rotation: 0, hidden: true },
      ],
      elements: [],
    };
    const savedPages = await alice.json(`/api/documents/${documentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overlay: reordered }),
    });
    check('บันทึกการจัดหน้าใหม่สำเร็จ', savedPages.status === 200);
    check('นับเฉพาะหน้าที่ไม่ถูกซ่อน', savedPages.body.document.pageCount === 2);

    const exported2 = new Uint8Array(
      await (
        await alice.fetch(`/api/documents/${documentId}/export`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ save: false }),
        })
      ).arrayBuffer(),
    );
    const inspected2 = await inspectPdf(exported2);
    check('หน้าที่ซ่อนไม่ถูก export', inspected2.pageCount === 2, String(inspected2.pageCount));
    check(
      'ลำดับหน้าใหม่ถูกใช้จริง (หน้าแรกคือหน้า 3 เดิม)',
      inspected2.pages[0].text.includes('PAGEMARKER-THREE'),
      inspected2.pages[0].text,
    );
    check(
      'การหมุนหน้าถูกเขียนลงไฟล์',
      inspected2.pages[1].rotation === 90,
      String(inspected2.pages[1].rotation),
    );

    // --- Quotas -------------------------------------------------------------
    console.log('\n[8] โควตาของแพ็กเกจ');
    const second = await upload(alice, 'doc2.pdf');
    const third = await upload(alice, 'doc3.pdf');
    check('อัปโหลดได้ถึงโควตาของแพ็กเกจ free', second.status === 201 && third.status === 201);

    const overLimit = await upload(alice, 'doc4.pdf');
    check('เกินโควตาเอกสารถูกปฏิเสธด้วย 402', overLimit.status === 402, JSON.stringify(overLimit.body));
    check('แจ้งรหัสข้อผิดพลาด quota_exceeded', overLimit.body.code === 'quota_exceeded');

    // --- Subscription -------------------------------------------------------
    console.log('\n[9] ระบบสมัครสมาชิก (โหมด sandbox)');
    const freePlanPro = await alice.json('/api/pro/ocr', { method: 'POST' });
    check(
      'แพ็กเกจ free เรียกฟีเจอร์ของ Pro ไม่ได้',
      freePlanPro.status === 402 && freePlanPro.body.code === 'feature_locked',
      JSON.stringify(freePlanPro.body),
    );

    const checkout = await alice.json('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'pro', interval: 'yearly' }),
    });
    check('เริ่ม checkout สำเร็จ', checkout.status === 200, JSON.stringify(checkout.body));
    check('ใช้ผู้ให้บริการ sandbox', checkout.body.provider === 'sandbox');
    check('อัปเกรดเป็นแพ็กเกจ pro แล้ว', checkout.body.user.plan === 'pro');
    check('รอบบิลเป็นรายปี', checkout.body.user.planInterval === 'yearly');

    const afterUpgrade = await alice.json('/api/auth/me');
    check('โควตาเพิ่มขึ้นตามแพ็กเกจใหม่', afterUpgrade.body.usage.maxDocuments === 200);
    check('ไม่มีลายน้ำในแพ็กเกจที่ชำระเงิน', afterUpgrade.body.usage.watermark === false);

    const fourth = await upload(alice, 'doc4.pdf');
    check('อัปโหลดเกินโควตาเดิมได้หลังอัปเกรด', fourth.status === 201);

    const exportedPaid = await inspectPdf(
      new Uint8Array(
        await (
          await alice.fetch(`/api/documents/${fourth.body.document.id}/export`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ save: false }),
          })
        ).arrayBuffer(),
      ),
    );
    check(
      'ไฟล์ของสมาชิกแบบชำระเงินไม่มีลายน้ำ',
      !exportedPaid.pages[0].text.includes('MeDF'),
      exportedPaid.pages[0].text,
    );

    const cancelled = await alice.json('/api/billing/cancel', { method: 'POST' });
    check('ยกเลิกการสมัครได้', cancelled.status === 200);
    check('ตั้งค่ายกเลิกเมื่อสิ้นรอบบิล', cancelled.body.user.cancelAtPeriodEnd === true);
    check('ยังใช้แพ็กเกจ pro ได้จนสิ้นรอบ', cancelled.body.user.plan === 'pro');

    const resumed = await alice.json('/api/billing/resume', { method: 'POST' });
    check('กลับมาต่ออายุได้', resumed.status === 200 && resumed.body.user.cancelAtPeriodEnd === false);

    // --- Open-core feature gate --------------------------------------------
    console.log('\n[10] ฟีเจอร์แบบชำระเงิน (open-core)');
    const features = await alice.json('/api/features');
    check('รายงานว่าติดตั้งโมดูลเสริมแล้ว', features.body.proInstalled === true);

    const byKey = Object.fromEntries(
      features.body.features.map((feature) => [feature.key, feature]),
    );
    check(
      'ฟีเจอร์ของ core ใช้ได้ในทุกแพ็กเกจ',
      byKey['editor.elements'].available === true && byKey['editor.elements'].source === 'core',
    );
    check(
      'ฟีเจอร์เสริมที่โมดูลรองรับและแพ็กเกจถึง ใช้ได้',
      byKey['pro.ocr'].available === true && byKey['pro.ocr'].source === 'private',
      JSON.stringify(byKey['pro.ocr']),
    );
    check(
      'ฟีเจอร์เสริมที่โมดูลไม่ได้รองรับ รายงานว่ายังไม่ได้ติดตั้ง',
      byKey['pro.redact'].available === false && byKey['pro.redact'].reason === 'not_installed',
      JSON.stringify(byKey['pro.redact']),
    );
    check(
      'ฟีเจอร์ระดับ Team ยังไม่เปิดให้แพ็กเกจ Pro',
      byKey['pro.templates'].available === false && byKey['pro.templates'].reason === 'plan',
      JSON.stringify(byKey['pro.templates']),
    );

    const proCall = await alice.json('/api/pro/ocr', { method: 'POST' });
    check('เรียกฟีเจอร์เสริมที่มีสิทธิ์ได้', proCall.status === 200, JSON.stringify(proCall.body));

    const lockedCall = await alice.json('/api/pro/templates', { method: 'POST' });
    check(
      'ฟีเจอร์ที่แพ็กเกจยังไม่ถึงถูกปิดด้วย 402',
      lockedCall.status === 402 && lockedCall.body.code === 'feature_locked',
      JSON.stringify(lockedCall.body),
    );

    const missingCall = await alice.json('/api/pro/does-not-exist', { method: 'POST' });
    check('เรียกฟีเจอร์ที่ไม่มีได้ 404', missingCall.status === 404);

    const anonymousPro = await anonymous.json('/api/pro/ocr', { method: 'POST' });
    check('ผู้ไม่ได้เข้าสู่ระบบเรียกฟีเจอร์เสริมไม่ได้', anonymousPro.status === 401);

    // --- Cross-account isolation -------------------------------------------
    console.log('\n[11] การแยกข้อมูลระหว่างสมาชิก');
    const bob = new Session();
    const bobRegistered = await bob.json('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bob', email: 'bob@example.com', password: PASSWORD }),
    });
    check('สมัครสมาชิกคนที่สองได้', bobRegistered.status === 201);
    check('สมาชิกคนที่สองเป็น member ไม่ใช่ admin', bobRegistered.body.user.role === 'member');

    const peek = await bob.json(`/api/documents/${documentId}`);
    check('อ่านเอกสารของคนอื่นไม่ได้ (403)', peek.status === 403, JSON.stringify(peek.body));

    // `assetId` was pruned when its element was removed in step 7, so upload a
    // fresh one to test ownership rather than existence.
    const liveAssetForm = new FormData();
    liveAssetForm.append('file', new File([pngBytes], 'stamp2.png', { type: 'image/png' }));
    liveAssetForm.append('width', '64');
    liveAssetForm.append('height', '64');
    const liveAsset = await alice.json(`/api/documents/${fourth.body.document.id}/assets`, {
      method: 'POST',
      body: liveAssetForm,
    });
    check('อัปโหลดรูปภาพใหม่สำเร็จ', liveAsset.status === 201, JSON.stringify(liveAsset.body));

    const peekAsset = await bob.fetch(`/api/assets/${liveAsset.body.asset.id}`);
    check('อ่านรูปภาพของคนอื่นไม่ได้ (403)', peekAsset.status === 403, String(peekAsset.status));

    const prunedAsset = await alice.fetch(`/api/assets/${assetId}`);
    check(
      'รูปภาพที่ไม่มีองค์ประกอบอ้างอิงถูกลบทิ้งอัตโนมัติ',
      prunedAsset.status === 404,
      String(prunedAsset.status),
    );

    const deleteOther = await bob.json(`/api/documents/${documentId}`, { method: 'DELETE' });
    check('ลบเอกสารของคนอื่นไม่ได้', deleteOther.status === 403);

    const bobDocuments = await bob.json('/api/documents');
    check('เห็นเฉพาะเอกสารของตัวเอง', bobDocuments.body.documents.length === 0);

    // --- Delete & session ---------------------------------------------------
    console.log('\n[12] ลบเอกสารและออกจากระบบ');
    const deleted = await alice.json(`/api/documents/${documentId}`, { method: 'DELETE' });
    check('เจ้าของลบเอกสารได้', deleted.status === 200);
    const afterDelete = await alice.json(`/api/documents/${documentId}`);
    check('เอกสารที่ลบแล้วหาไม่พบ', afterDelete.status === 404);

    const changed = await alice.json('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: PASSWORD, newPassword: 'BrandNewPass456' }),
    });
    check('เปลี่ยนรหัสผ่านสำเร็จ', changed.status === 200, JSON.stringify(changed.body));
    const afterPasswordChange = await alice.json('/api/auth/me');
    check('เซสชันเดิมถูกยกเลิกหลังเปลี่ยนรหัสผ่าน', afterPasswordChange.body.user === null);

    const reLogin = await alice.json('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', password: 'BrandNewPass456' }),
    });
    check('เข้าสู่ระบบด้วยรหัสผ่านใหม่ได้', reLogin.status === 200);

    await alice.fetch('/api/auth/logout', { method: 'POST' });
    const afterLogout = await alice.json('/api/auth/me');
    check('ออกจากระบบแล้วไม่มีเซสชัน', afterLogout.body.user === null);

    process.exitCode = checker.report();
  } catch (error) {
    console.error(`\n❌ ${error.message}`);
    console.error('\n--- server log ---\n' + server.output().slice(-4000));
    process.exitCode = 1;
  } finally {
    server.stop();
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (!process.env.MEDF_KEEP_SMOKE_DATA) await rm(dataDir, { recursive: true, force: true });
  }
}

/** Reads an exported PDF back with pdf.js and reports text, geometry and images. */
async function inspectPdf(bytes) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({
    data: bytes,
    // No DOM in Node: turn off everything that needs one.
    isEvalSupported: false,
    useSystemFonts: false,
    standardFontDataUrl: undefined,
  }).promise;

  const pages = [];
  for (let index = 1; index <= document.numPages; index += 1) {
    const page = await document.getPage(index);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const operators = await page.getOperatorList();

    const items = content.items
      .filter((item) => 'str' in item && item.str.trim() !== '')
      .map((item) => {
        // `transform` is in PDF user space; the viewport maps it to what the
        // member saw on screen, which is what element coordinates describe.
        const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        return { text: item.str, displayX: x, displayY: y };
      });

    pages.push({
      text: items.map((item) => item.text).join(' '),
      items,
      rotation: page.rotate,
      displayWidth: viewport.width,
      displayHeight: viewport.height,
      hasImage: operators.fnArray.some((fn) =>
        [pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintInlineImageXObject].includes(fn),
      ),
    });
  }

  const result = { pageCount: document.numPages, pages };
  await document.destroy?.();
  return result;
}

/** Smallest possible valid PNG: a single red pixel, scaled by the element box. */
function makeRedPng() {
  return Uint8Array.from(
    atob(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
    ),
    (char) => char.charCodeAt(0),
  );
}

await main();
