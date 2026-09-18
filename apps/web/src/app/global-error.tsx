'use client';

import { useEffect } from 'react';
import { createTranslator } from '@/lib/i18n';
import { detectLocaleInBrowser } from '@/lib/i18n/provider';

/**
 * Last resort: the root layout itself failed, so there is no `<html>` yet and
 * none of the app's own chrome can be trusted to render.
 *
 * That also means no stylesheet, so this one page carries its own inline
 * styles rather than the utility classes every other screen uses.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // The root layout failed, so there is no LocaleProvider above this to ask.
  const locale = detectLocaleInBrowser();
  const t = createTranslator(locale);

  useEffect(() => {
    console.error('[medf] fatal error', error);
  }, [error]);

  return (
    <html lang={locale}>
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '2rem',
          textAlign: 'center',
          background: '#f8fafc',
          color: '#0f172a',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <p style={{ fontSize: '3rem', fontWeight: 800, color: '#4f46e5', margin: 0 }}>MeDF</p>
        <h1 style={{ fontSize: '1.15rem', margin: 0 }}>{t('error.fatalTitle')}</h1>
        <p style={{ maxWidth: '28rem', fontSize: '0.9rem', lineHeight: 1.7, color: '#475569' }}>
          {t('error.fatalBody')}
          {error.digest ? ` (${t('error.reference', { digest: error.digest })})` : ''}
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            border: 0,
            borderRadius: '0.75rem',
            background: '#4f46e5',
            color: '#fff',
            padding: '0.6rem 1.25rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('common.retry')}
        </button>
      </body>
    </html>
  );
}
