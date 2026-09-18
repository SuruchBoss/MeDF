// Copies the pdf.js worker into /public so it can be served locally.
// Serving the worker from our own origin keeps the editor working fully
// offline (important for the packaged Windows desktop build).
import { copyFile, mkdir, access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
// The legacy worker must match the legacy main bundle the editor imports.
const candidates = [
  'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  'pdfjs-dist/legacy/build/pdf.worker.mjs',
  'pdfjs-dist/build/pdf.worker.min.mjs',
];

const outDir = path.join(import.meta.dirname, '..', 'public');
const outFile = path.join(outDir, 'pdf.worker.min.mjs');

let source;
for (const candidate of candidates) {
  try {
    source = require.resolve(candidate);
    break;
  } catch {
    /* try next */
  }
}

if (!source) {
  console.error('[copy-pdf-worker] could not resolve the pdf.js worker from pdfjs-dist');
  process.exit(1);
}

await mkdir(outDir, { recursive: true });
await copyFile(source, outFile);
await access(outFile);
console.log(`[copy-pdf-worker] ${path.relative(process.cwd(), source)} -> public/pdf.worker.min.mjs`);
