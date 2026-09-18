'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, Logo, Spinner } from '@/components/icons';
import { EditorShell } from '@/components/editor/editor-shell';
import { DemoBackend } from '@/components/editor/demo-backend';
import type { OverlayDoc } from '@/lib/editor-types';
import { createBrowserFontLoader } from '@/lib/pdf/fonts-browser';
import { PdfGeometryError, readPageGeometry } from '@/lib/pdf/page-geometry';
import { createSampleDocument } from '@/lib/pdf/sample-document';
import { withBasePath } from '@/lib/base-path';
import { formatBytes } from '@/lib/format';
import { PLANS } from '@/lib/plans';
import type { MessageKey } from '@/lib/i18n';
import { useLocale, useT } from '@/lib/i18n/provider';

/**
 * The try-it-now experience.
 *
 * Runs the real editor with a browser-only backend: the visitor's PDF is read
 * locally, edited, and exported by the same renderer the server uses. Nothing
 * is uploaded, so this page works as a static file — which is what makes it
 * publishable to GitHub Pages.
 *
 * It applies the Free plan's limits so the demo is an honest preview.
 */

const FREE = PLANS.free.limits;

interface Session {
  backend: DemoBackend;
  overlay: OverlayDoc;
  title: string;
}

export function DemoEditor({ homeHref = '/' }: { homeHref?: string }) {
  const t = useT();
  const locale = useLocale();
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState<'file' | 'sample' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Release the object URLs when the visitor loads another document or leaves.
  const previous = useRef<DemoBackend | null>(null);
  useEffect(() => {
    previous.current?.dispose();
    previous.current = session?.backend ?? null;
  }, [session]);
  useEffect(() => () => previous.current?.dispose(), []);

  const open = useCallback(async (bytes: Uint8Array, title: string, sizeBytes: number) => {
    setError(null);

    const maxBytes = FREE.maxUploadMb * 1024 * 1024;
    if (sizeBytes > maxBytes) {
      setError(t('demo.tooLarge', { size: formatBytes(sizeBytes), limit: FREE.maxUploadMb }));
      return;
    }

    try {
      const pages = await readPageGeometry(bytes);
      if (pages.length > FREE.maxPages) {
        setError(t('demo.tooManyPages', { pages: pages.length, limit: FREE.maxPages }));
        return;
      }
      setSession({
        backend: new DemoBackend(bytes, title),
        overlay: { version: 1, pages, elements: [] },
        title,
      });
    } catch (openError) {
      setError(
        openError instanceof PdfGeometryError
          ? t(openError.key, openError.params)
          : t('demo.openFailed', { reason: (openError as Error).message }),
      );
    }
  }, [t]);

  async function handleFile(file: File) {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setError(t('demo.onlyPdf'));
      return;
    }
    setBusy('file');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      await open(bytes, file.name.replace(/\.pdf$/i, '') || t('demo.untitled'), bytes.byteLength);
    } finally {
      setBusy(null);
    }
  }

  async function handleSample() {
    setBusy('sample');
    try {
      const bytes = await createSampleDocument(
        createBrowserFontLoader(withBasePath('/fonts')),
        locale,
      );
      await open(bytes, t('demo.sampleTitle'), bytes.byteLength);
    } catch (sampleError) {
      setError(t('demo.sampleFailed', { reason: (sampleError as Error).message }));
    } finally {
      setBusy(null);
    }
  }

  if (session) {
    return (
      <div className="relative">
        <EditorShell
          key={session.backend.pdfUrl}
          backend={session.backend}
          title={session.title}
          revision={1}
          overlay={session.overlay}
          plan="free"
          watermark={FREE.watermark}
          backHref={homeHref}
          backLabel={t('demo.back')}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <header className="border-b border-ink-200 bg-white">
        <div className="container-page flex h-16 items-center justify-between">
          <Link href={homeHref} className="text-ink-900">
            <Logo />
          </Link>
          <span className="badge bg-brand-50 text-brand-700">{t('demo.badge')}</span>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-2xl">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              {t('demo.title')}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-ink-600">
              {t('demo.intro')}
            </p>
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files[0];
              if (file) void handleFile(file);
            }}
            className={`card mt-9 flex flex-col items-center border-2 border-dashed px-6 py-12 text-center transition ${
              dragging ? 'border-brand-500 bg-brand-50' : 'border-ink-200'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFile(file);
                event.target.value = '';
              }}
            />

            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Icon name="upload" size={26} />
            </span>
            <h2 className="mt-4 text-lg font-bold text-ink-900">{t('demo.dropHere')}</h2>
            <p className="mt-1 text-sm text-ink-500">
              {t('demo.dropLimits', { size: FREE.maxUploadMb, pages: FREE.maxPages })}
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                className="btn-primary"
                onClick={() => inputRef.current?.click()}
                disabled={busy != null}
              >
                {busy === 'file' ? <Spinner size={17} /> : <Icon name="file-text" size={17} />}
                {t('demo.pickFile')}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => void handleSample()}
                disabled={busy != null}
              >
                {busy === 'sample' ? <Spinner size={17} /> : <Icon name="sparkles" size={17} />}
                {t('demo.useSample')}
              </button>
            </div>

            {error ? (
              <p
                role="alert"
                className="mt-5 w-full rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
              >
                {error}
              </p>
            ) : null}
          </div>

          <ul className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              {
                icon: 'shield' as const,
                title: 'demo.point.private' as MessageKey,
                body: 'demo.point.privateBody' as MessageKey,
              },
              {
                icon: 'cursor' as const,
                title: 'demo.point.tools' as MessageKey,
                body: 'demo.point.toolsBody' as MessageKey,
              },
              {
                icon: 'download' as const,
                title: 'demo.point.export' as MessageKey,
                body: 'demo.point.exportBody' as MessageKey,
              },
            ].map((item) => (
              <li key={item.title} className="card p-4">
                <Icon name={item.icon} size={18} className="text-brand-600" />
                <p className="mt-2 text-sm font-semibold text-ink-900">{t(item.title)}</p>
                <p className="mt-0.5 text-xs text-ink-500">{t(item.body)}</p>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-center text-xs text-ink-400">
            {t('demo.warning')}
          </p>
        </div>
      </main>
    </div>
  );
}
