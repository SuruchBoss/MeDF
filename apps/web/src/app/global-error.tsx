'use client';

import { useEffect } from 'react';

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
  useEffect(() => {
    console.error('[medf] fatal error', error);
  }, [error]);

  return (
    <html lang="th">
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
        <h1 style={{ fontSize: '1.15rem', margin: 0 }}>ระบบขัดข้อง</h1>
        <p style={{ maxWidth: '28rem', fontSize: '0.9rem', lineHeight: 1.7, color: '#475569' }}>
          ไม่สามารถโหลดหน้าเว็บได้ กรุณาลองใหม่อีกครั้ง หากยังไม่ได้ให้รีเฟรชเบราว์เซอร์
          {error.digest ? ` (รหัสอ้างอิง: ${error.digest})` : ''}
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
          ลองใหม่อีกครั้ง
        </button>
      </body>
    </html>
  );
}
