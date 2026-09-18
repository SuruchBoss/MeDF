import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FontLoader } from './fonts';

/**
 * Server-side font loader: reads the bundled TTFs from `public/fonts`.
 *
 * The directory is resolved at runtime because the same code runs from the
 * repository, from a `standalone` bundle and from inside the packaged desktop
 * app, and those have different layouts.
 */

function fontDirCandidates(): string[] {
  return [
    path.join(process.cwd(), 'public', 'fonts'),
    path.join(process.cwd(), 'apps', 'web', 'public', 'fonts'),
    path.join(import.meta.dirname ?? '', '..', '..', '..', 'public', 'fonts'),
  ];
}

const cache = new Map<string, Promise<Uint8Array>>();

export const nodeFontLoader: FontLoader = (fileName) => {
  const cached = cache.get(fileName);
  if (cached) return cached;

  const promise = (async () => {
    const tried: string[] = [];
    for (const dir of fontDirCandidates()) {
      // The directory is only known at runtime; tell Turbopack not to trace it,
      // or it pulls the whole project into the server bundle.
      const candidate = path.join(/* turbopackIgnore: true */ dir, fileName);
      tried.push(candidate);
      try {
        return new Uint8Array(await fs.readFile(candidate));
      } catch {
        /* try the next location */
      }
    }
    throw new Error(`ไม่พบไฟล์ฟอนต์ ${fileName} (ค้นหาที่: ${tried.join(', ')})`);
  })();

  cache.set(fileName, promise);
  return promise;
};
