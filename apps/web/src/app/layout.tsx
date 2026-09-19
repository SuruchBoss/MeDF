import type { Metadata, Viewport } from 'next';
import { FontFaces } from '@/components/font-faces';
import { LocaleProvider } from '@/lib/i18n/provider';
import { th } from '@/lib/i18n/th';
import '@/styles/globals.css';

/**
 * The app is a static export, so nothing here can read a cookie or a header:
 * every page is one prerendered file served to everybody. The locale is
 * therefore picked in the browser — `LocaleProvider` reads the cookie and the
 * browser's own preference — and `<html lang>` starts at the default and is
 * corrected on hydration.
 *
 * The metadata below is Thai for the same reason — a link preview has to pick
 * one language before anyone arrives, and MeDF is a Thai-market tool
 * (docs/PRODUCT_DIRECTION.md §2). It is read from the dictionary rather than
 * typed out, so the strings stay in one place.
 */
export const metadata: Metadata = {
  title: { default: th['meta.title'], template: '%s · MeDF' },
  description: th['meta.description'],
  keywords: ['PDF', 'PDF editor', 'edit PDF', th['meta.keywordEdit'], th['meta.keywordSign'], 'MeDF'],
  applicationName: 'MeDF',
  authors: [{ name: 'MeDF' }],
  openGraph: { title: th['meta.title'], description: th['meta.description'], type: 'website' },
};

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <FontFaces />
      </head>
      <body className="min-h-full font-sans antialiased">
        <LocaleProvider locale="detect">{children}</LocaleProvider>
      </body>
    </html>
  );
}
