/**
 * Creates a working skeleton of the paid add-on module at
 * `apps/web/src/pro-private/`.
 *
 * That directory is git-ignored and guarded, so it is a safe place to develop
 * paid features locally; the code you put there is meant to live in a separate
 * private repository and be shipped as a built module (see docs/OPEN_CORE.md).
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const target = path.join(import.meta.dirname, '..', 'apps', 'web', 'src', 'pro-private');

if (existsSync(path.join(target, 'index.js'))) {
  console.log(`[scaffold-pro] มีโมดูลอยู่แล้วที่ ${target} — ไม่เขียนทับ`);
  process.exit(0);
}

mkdirSync(target, { recursive: true });

writeFileSync(
  path.join(target, 'index.js'),
  `'use strict';

/**
 * MeDF paid add-on module (local development copy).
 *
 * This file is git-ignored on purpose. Develop paid features here, then move
 * them to your private repository and ship a built module via
 * MEDF_PRO_MODULE or the @medf/pro package.
 *
 * Contract: see ProModule in apps/web/src/lib/pro.ts
 * Feature keys must be declared in apps/web/src/lib/features.ts
 */

module.exports = {
  id: 'medf-pro-dev',
  version: '0.0.0-dev',

  // Only keys declared in features.ts with source: 'private'.
  features: ['pro.ocr', 'pro.redact', 'pro.templates', 'pro.batch'],

  server: {
    /**
     * Runs after the core renderer has produced the PDF. Return the bytes you
     * want the member to download. This code never reaches the browser.
     */
    async transformExport(bytes, context) {
      console.log(
        \`[medf-pro] export hook: \${context.documentTitle} (\${bytes.byteLength} bytes, plan \${context.user.plan})\`,
      );
      return bytes;
    },

    /** Mounted at /api/pro/<name>, gated by the declared feature. */
    handlers: {
      ocr: {
        feature: 'pro.ocr',
        async handle(request, user) {
          return Response.json({ ok: true, member: user.id, note: 'ใส่โค้ด OCR ของคุณที่นี่' });
        },
      },
    },
  },
};
`,
);

writeFileSync(
  path.join(target, 'README.md'),
  `# โมดูลฟีเจอร์แบบชำระเงิน (สำเนาสำหรับพัฒนา)

โฟลเดอร์นี้อยู่ใน \`.gitignore\` และถูกตรวจโดย \`npm run guard:private\`
จึงไม่มีทางถูก commit เข้า repository สาธารณะ

โค้ดจริงควรอยู่ใน repository ส่วนตัวแยก แล้วนำมาใช้ตอน deploy ด้วย
\`MEDF_PRO_MODULE=/path/to/module/index.js\` หรือติดตั้งเป็นแพ็กเกจ \`@medf/pro\`

อ่านรายละเอียดที่ \`docs/OPEN_CORE.md\`
`,
);

console.log(`[scaffold-pro] สร้างโมดูลตัวอย่างที่ ${target}`);
console.log('[scaffold-pro] รีสตาร์ตเซิร์ฟเวอร์เพื่อให้โมดูลถูกโหลด');
