'use client';

import { useEffect, useState } from 'react';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';
import { withBasePath } from '@/lib/base-path';
import { createTranslator } from '@/lib/i18n';
import { detectLocaleInBrowser } from '@/lib/i18n/provider';

/**
 * Loads pdf.js lazily (it is a large, browser-only bundle) and opens a
 * document. The worker is served from our own `/public`, so the editor works
 * with no outbound network access — which is what the desktop build needs.
 */

type Pdfjs = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<Pdfjs> | null = null;

/**
 * The *legacy* build is deliberate: the modern one calls
 * `Map.prototype.getOrInsertComputed`, which only landed in very recent
 * browsers, so it renders nothing on anything slightly older. The legacy build
 * bundles the polyfills and behaves identically for our purposes.
 */
export function loadPdfjs(): Promise<Pdfjs> {
  pdfjsPromise ??= (import('pdfjs-dist/legacy/build/pdf.mjs') as Promise<Pdfjs>).then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = withBasePath('/pdf.worker.min.mjs');
    return pdfjs;
  });
  return pdfjsPromise;
}

export interface PdfState {
  document: PDFDocumentProxy | null;
  loading: boolean;
  error: string | null;
}

export function usePdfDocument(url: string): PdfState {
  const [state, setState] = useState<PdfState>({ document: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    let task: PDFDocumentLoadingTask | null = null;

    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        task = pdfjs.getDocument({
          url,
          withCredentials: true,
          // Keeps memory flat on long documents.
          disableAutoFetch: false,
          disableStream: false,
        });
        const loaded = await task.promise;
        if (cancelled) return;
        setState({ document: loaded, loading: false, error: null });
      } catch (error) {
        if (cancelled) return;
        setState({
          document: null,
          loading: false,
          error:
            error instanceof Error
              ? createTranslator(detectLocaleInBrowser())('pdf.openFailed', {
                  reason: error.message,
                })
              : createTranslator(detectLocaleInBrowser())('pdf.openFailedShort'),
        });
      }
    })();

    return () => {
      cancelled = true;
      // Destroying the loading task tears down the worker and the document.
      void task?.destroy();
    };
  }, [url]);

  return state;
}
