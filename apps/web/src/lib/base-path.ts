/**
 * Base path handling.
 *
 * The product is served from the root of its own domain, but the public
 * try-it-now build is published to GitHub Pages under `/<repo>/`. Next.js
 * rewrites its own `/_next/...` URLs and `next/link` hrefs for `basePath`, but
 * not URLs we build ourselves (the pdf.js worker, the font files), so those go
 * through `withBasePath`.
 */

export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function withBasePath(path: string): string {
  if (!BASE_PATH) return path;
  return `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
}
