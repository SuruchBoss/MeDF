'use client';

import type { FontLoader } from './fonts';

/**
 * Browser font loader: fetches the same TTFs the page already uses as web
 * fonts, so the demo build can embed them into an exported PDF without a
 * server. Bytes are cached for the lifetime of the page.
 */

const cache = new Map<string, Promise<Uint8Array>>();

export function createBrowserFontLoader(baseUrl = '/fonts'): FontLoader {
  return (fileName) => {
    const key = `${baseUrl}/${fileName}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const promise = (async () => {
      const response = await fetch(key);
      if (!response.ok) {
        throw new Error(`Could not load font ${fileName} (${response.status})`);
      }
      return new Uint8Array(await response.arrayBuffer());
    })();

    cache.set(key, promise);
    return promise;
  };
}
