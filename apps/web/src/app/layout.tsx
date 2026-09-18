import type { Metadata, Viewport } from 'next';
import { FontFaces } from '@/components/font-faces';
import { LocaleProvider } from '@/lib/i18n/provider';
import { getLocale, getTranslator } from '@/lib/i18n/server';
import '@/styles/globals.css';

/** Search results and link previews follow the reader's language too. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslator();
  const title = t('meta.title');
  const description = t('meta.description');

  return {
    title: { default: title, template: '%s · MeDF' },
    description,
    keywords: ['PDF', 'PDF editor', 'edit PDF', 'sign PDF', 'แก้ไข PDF', 'เซ็นเอกสาร', 'MeDF'],
    applicationName: 'MeDF',
    authors: [{ name: 'MeDF' }],
    openGraph: { title, description, type: 'website' },
  };
}

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolved on the server so the first client render matches the HTML it is
  // hydrating; a mismatch here would be a hydration error on every page.
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <head>
        <FontFaces />
      </head>
      <body className="min-h-full font-sans antialiased">
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
