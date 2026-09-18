/**
 * Copies the runtime assets the demo needs into its own `public/`: the Sarabun
 * fonts (used on screen *and* embedded into exported PDFs) and the pdf.js
 * worker. They are generated or vendored in `apps/web`, so this keeps one
 * source of truth.
 */
import { cp, mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const demoRoot = path.join(import.meta.dirname, '..');
const webRoot = path.join(demoRoot, '..', 'web');
const publicDir = path.join(demoRoot, 'public');

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

await mkdir(publicDir, { recursive: true });

// The worker is copied out of node_modules by the web app's own script.
if (!(await exists(path.join(webRoot, 'public', 'pdf.worker.min.mjs')))) {
  execFileSync(process.execPath, [path.join(webRoot, 'scripts', 'copy-pdf-worker.mjs')], {
    cwd: webRoot,
    stdio: 'inherit',
  });
}

await cp(path.join(webRoot, 'public', 'fonts'), path.join(publicDir, 'fonts'), {
  recursive: true,
});
await cp(
  path.join(webRoot, 'public', 'pdf.worker.min.mjs'),
  path.join(publicDir, 'pdf.worker.min.mjs'),
);

// GitHub Pages would otherwise run Jekyll, which ignores `_next`.
await writeFile(path.join(publicDir, '.nojekyll'), '');

console.log('[copy-assets] fonts, pdf.js worker และ .nojekyll พร้อมแล้ว');
