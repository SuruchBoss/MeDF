'use client';

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { useT } from '@/lib/i18n/provider';

/**
 * Renders one page of the source PDF into a canvas.
 *
 * The canvas always covers the page's *base* display box (the CSS size is
 * driven by the parent's zoom transform); only the bitmap resolution follows
 * `renderScale`, so zooming stays sharp without re-layout.
 */
export function PdfPageCanvas({
  pdf,
  sourceIndex,
  width,
  height,
  renderScale,
  active,
}: {
  pdf: PDFDocumentProxy | null;
  /** Zero-based page index in the source document. */
  sourceIndex: number;
  width: number;
  height: number;
  renderScale: number;
  /** False when the page is far outside the viewport. */
  active: boolean;
}) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const taskRef = useRef<RenderTask | null>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!pdf || !active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;

    (async () => {
      try {
        const page = await pdf.getPage(sourceIndex + 1);
        if (cancelled) return;

        // `getViewport` already accounts for the page's own /Rotate, so the
        // unscaled viewport matches our stored base page size.
        const viewport = page.getViewport({ scale: renderScale });
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return;

        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);

        taskRef.current?.cancel();
        const task = page.render({ canvas, canvasContext: context, viewport });
        taskRef.current = task;
        await task.promise;
        if (!cancelled) setRendered(true);
      } catch (error) {
        // `RenderingCancelledException` is expected whenever zoom changes mid-render.
        if ((error as { name?: string })?.name !== 'RenderingCancelledException') {
          console.error('[medf] page render failed', error);
        }
      }
    })();

    return () => {
      cancelled = true;
      taskRef.current?.cancel();
      taskRef.current = null;
    };
  }, [pdf, sourceIndex, renderScale, active]);

  return (
    <>
      <canvas
        ref={canvasRef}
        // True once pdf.js has painted this page at least once. The canvas has
        // its final dimensions well before that, so this is what tests must
        // wait for before reading pixels back.
        data-rendered={rendered}
        style={{
          width,
          height,
          display: 'block',
          background: '#fff',
        }}
      />
      {!rendered ? (
        <div
          className="absolute inset-0 flex items-center justify-center bg-white text-xs text-ink-400"
          aria-hidden="true"
        >
          {t('stage.renderingPage', { number: sourceIndex + 1 })}
        </div>
      ) : null}
    </>
  );
}
