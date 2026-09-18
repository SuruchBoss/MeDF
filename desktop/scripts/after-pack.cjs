'use strict';

/**
 * Copies the Next.js `standalone` bundle into the packaged app's resources.
 *
 * electron-builder's `extraResources` cannot be used here: it strips
 * `node_modules` from extra resource trees, and the server does not start
 * without it (electron-userland/electron-builder#3185). Copying in `afterPack`
 * keeps the whole tree intact, and it runs before the installer is assembled
 * so both the NSIS and portable targets pick it up.
 *
 * The destination is `resources/server` rather than `resources/app`, because
 * Electron treats `resources/app` as an application directory.
 */

const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(context) {
  const source = path.join(__dirname, '..', 'resources', 'app');
  const target = path.join(context.appOutDir, 'resources', 'server');

  if (!fs.existsSync(path.join(source, 'apps', 'web', 'server.js'))) {
    throw new Error(
      `[after-pack] ไม่พบบันเดิลเซิร์ฟเวอร์ที่ ${source} — รัน "npm run desktop:build" ก่อนแพ็ก`,
    );
  }

  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true, dereference: true });

  const required = [
    path.join(target, 'apps', 'web', 'server.js'),
    path.join(target, 'apps', 'web', 'public', 'pdf.worker.min.mjs'),
    path.join(target, 'apps', 'web', '.next', 'static'),
    path.join(target, 'node_modules', 'next'),
  ];
  for (const item of required) {
    if (!fs.existsSync(item)) {
      throw new Error(`[after-pack] บันเดิลไม่ครบ ขาด: ${item}`);
    }
  }

  console.log(`  • bundled MeDF server  to=resources/server`);
};
