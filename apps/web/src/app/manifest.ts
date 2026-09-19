import type { MetadataRoute } from 'next';
import { th } from '@/lib/i18n/th';

/**
 * The web app manifest, which is what lets a member add MeDF to a phone's
 * home screen and open it without browser chrome.
 *
 * `display: 'standalone'` and `start_url: '/app'` mean the installed copy
 * opens on the member's documents rather than the marketing page — the same
 * place the desktop build opens.
 *
 * It used to follow the reader's language. A static export has one manifest
 * for everybody, so it is Thai — the same choice, for the same reason, as the
 * metadata in the root layout.
 */
// A metadata route is a route handler, and `output: export` needs to be told
// it may be rendered once at build time.
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: th['meta.title'],
    short_name: 'MeDF',
    description: th['meta.description'],
    lang: 'th',
    start_url: '/try',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    // Matches `<body>`'s background and the theme colour in the root layout,
    // so the splash screen does not flash a different colour on the way in.
    background_color: '#f6f7fb',
    theme_color: '#4f46e5',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Cropped to the launcher's own shape, so the mark is inset and the
      // background bleeds to the edge; see desktop/scripts/make-icon.mjs.
      { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
