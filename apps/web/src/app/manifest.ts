import type { MetadataRoute } from 'next';
import { getLocale, getTranslator } from '@/lib/i18n/server';

/**
 * The web app manifest, which is what lets a member add MeDF to a phone's
 * home screen and open it without browser chrome.
 *
 * `display: 'standalone'` and `start_url: '/app'` mean the installed copy
 * opens on the member's documents rather than the marketing page — the same
 * place the desktop build opens.
 *
 * It follows the reader's language like every other page: the manifest is
 * fetched with the member's cookies, so `getTranslator()` resolves the same
 * locale the site is already showing them.
 */
export const dynamic = 'force-dynamic';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslator();

  return {
    name: t('meta.title'),
    short_name: 'MeDF',
    description: t('meta.description'),
    lang: await getLocale(),
    start_url: '/app',
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
