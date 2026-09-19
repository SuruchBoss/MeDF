'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, Logo, Spinner } from '@/components/icons';
import { EditorShell } from '@/components/editor/editor-shell';
import { DemoBackend } from '@/components/editor/demo-backend';
import { LocalBackend, storeFailureKey } from '@/components/editor/local-backend';
import { RecentDocuments } from '@/components/editor/recent-documents';
import {
  type StoredDocument,
  createDocument,
  deleteDocument,
  estimateUsage,
  isAvailable,
  listDocuments,
  readAssets,
  readDocument,
  readOverlay,
  readSource,
} from '@/lib/client/local-store';
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
 * The editor, and the screen that chooses what to open.
 *
 * The visitor's PDF is read in the browser, edited there, and exported by the
 * same renderer throughout. Nothing is uploaded — which is both the product's
 * main promise and what lets the whole app ship as static files.
 *
 * Work is kept in IndexedDB, so closing the tab no longer throws it away. A
 * browser that refuses to store anything (a private window) still gets a
 * working editor on `DemoBackend`; it just says so rather than pretending to
 * save.
 *
 * Which document is open lives in `?doc=<id>` rather than a route, because a
 * static export cannot prerender `/editor/[id]` — and it means reload, Back
 * and a bookmark all behave.
 */

const FREE = PLANS.free.limits;

interface Session {
  backend: DemoBackend | LocalBackend;
  overlay: OverlayDoc;
  title: string;
  revision: number;
}

export function EditorPage({ homeHref = '/' }: { homeHref?: string }) {
  const t = useT();
  const locale = useLocale();
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState<'file' | 'sample' | 'open' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [usage, setUsage] = useState<{ usedBytes: number; quotaBytes: number } | null>(null);
  const [storable, setStorable] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Release the object URLs when the visitor loads another document or leaves.
  const previous = useRef<DemoBackend | LocalBackend | null>(null);
  useEffect(() => {
    previous.current?.dispose();
    previous.current = session?.backend ?? null;
  }, [session]);
  useEffect(() => () => previous.current?.dispose(), []);

  const refreshList = useCallback(async () => {
    try {
      setDocuments(await listDocuments());
      setUsage(await estimateUsage());
    } catch {
      // A browser that cannot list is a browser that cannot store; the
      // banner below already says so, and an empty list is the truth.
      setDocuments([]);
    }
  }, []);

  /** Opens a document already in the store, by id. */
  const openStored = useCallback(
    async (id: string) => {
      setBusy('open');
      setError(null);
      try {
        const [record, source, overlay, assets] = await Promise.all([
          readDocument(id),
          readSource(id),
          readOverlay(id),
          readAssets(id),
        ]);
        if (!record || !source || !overlay) {
          setError(t('store.loadFailed'));
          return;
        }
        const bytes = new Uint8Array(await source.arrayBuffer());
        setSession({
          backend: new LocalBackend({
            documentId: id,
            bytes,
            title: record.title,
            revision: record.revision,
            stored: assets,
          }),
          overlay,
          title: record.title,
          revision: record.revision,
        });
      } catch (loadError) {
        setError(t(storeFailureKey(loadError)));
      } finally {
        setBusy(null);
      }
    },
    [t],
  );

  /**
   * Start-up, in one pass: can this browser store anything, what is already
   * here, and does `?doc=<id>` name something to reopen.
   *
   * One effect rather than three, and every `setState` sits after an `await`
   * — a synchronous one here would run before the browser has painted the
   * first frame and cost a second render for nothing.
   *
   * `started` makes it once-only. Without it a locale change (which rebuilds
   * `openStored`) would reopen a document the member had already closed.
   */
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    let cancelled = false;
    void (async () => {
      const available = await isAvailable();
      if (cancelled) return;
      setStorable(available);
      if (!available) return;

      await refreshList();
      if (cancelled) return;

      const id = new URLSearchParams(window.location.search).get('doc');
      if (id) await openStored(id);
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshList, openStored]);

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
      const overlay: OverlayDoc = { version: 1, pages, elements: [] };

      // Without somewhere to keep it, the editor still runs — it just cannot
      // promise the work will be here tomorrow, and the banner says so.
      if (storable !== true) {
        setSession({ backend: new DemoBackend(bytes, title), overlay, title, revision: 1 });
        return;
      }

      try {
        const record = await createDocument({
          title,
          source: new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' }),
          overlay,
          pageCount: pages.length,
        });
        // The address changes without a navigation: this is one client-side
        // app, and reloading should land back on this document.
        window.history.replaceState(null, '', `?doc=${record.id}`);
        setSession({
          backend: new LocalBackend({
            documentId: record.id,
            bytes,
            title,
            revision: record.revision,
            stored: [],
          }),
          overlay,
          title,
          revision: record.revision,
        });
        void refreshList();
      } catch (storeError) {
        // Out of room, or the store went away mid-session. Better to open the
        // document unsaved and say so than to refuse to open it at all.
        setError(t(storeFailureKey(storeError)));
        setSession({ backend: new DemoBackend(bytes, title), overlay, title, revision: 1 });
      }
    } catch (openError) {
      setError(
        openError instanceof PdfGeometryError
          ? t(openError.key, openError.params)
          : t('demo.openFailed', { reason: (openError as Error).message }),
      );
    }
  }, [t, storable, refreshList]);

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
          revision={session.revision}
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
          <div className="mb-9 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              {t('demo.title')}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-ink-600">
              {t('demo.intro')}
            </p>
          </div>

          <RecentDocuments
            documents={documents}
            usage={usage}
            onOpen={(id) => {
              window.history.replaceState(null, '', `?doc=${id}`);
              void openStored(id);
            }}
            onDelete={(id) => {
              void deleteDocument(id)
                .then(refreshList)
                .catch((deleteError: unknown) => setError(t(storeFailureKey(deleteError))));
            }}
          />

          {storable === false ? (
            <p
              role="status"
              className="mb-6 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900"
            >
              <Icon name="shield" size={16} className="mt-0.5 shrink-0" />
              <span>{t('store.unavailable')}</span>
            </p>
          ) : null}

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
            className={`card flex flex-col items-center border-2 border-dashed px-6 py-12 text-center transition ${
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

          <p className="mt-6 text-center text-xs text-ink-500">
            {t('demo.warning')}
          </p>
        </div>
      </main>
    </div>
  );
}
