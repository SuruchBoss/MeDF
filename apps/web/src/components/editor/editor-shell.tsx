'use client';

import { useCallback, useMemo, useReducer, useRef, useState } from 'react';
import { Icon, Spinner } from '@/components/icons';
import { useDialog } from '@/components/ui/dialog';
import { useT } from '@/lib/i18n/provider';
import { ApiError } from '@/lib/client/fetcher';
import type { OverlayDoc } from '@/lib/editor-types';
import type { PlanId } from '@/lib/plans';
import type { EditorBackend } from './backend';
import { createImageElement, createSignatureElement } from './factories';
import { PagesPanel } from './pages-panel';
import { PageStage } from './page-stage';
import { PropertiesPanel } from './properties-panel';
import { SignaturePad } from './signature-pad';
import { createInitialState, editorReducer } from './store';
import { Toolbar } from './toolbar';
import { useAutosave } from './use-autosave';
import { useEditorShortcuts } from './use-editor-shortcuts';
import { usePdfDocument } from './use-pdf';
import { useZoomFit } from './use-zoom-fit';
import { useInView } from './use-in-view';

/**
 * The editor. Owns document state, autosave, keyboard shortcuts, asset uploads
 * and export; the child components stay presentational.
 *
 * Everything that leaves the browser goes through `backend`, so the same
 * editor drives the real product and the browser-only demo.
 */

const PAGE_GAP = 28;

export interface EditorShellProps {
  backend: EditorBackend;
  /** Initial document identity; the editor keeps the title in its own state. */
  title: string;
  revision: number;
  overlay: OverlayDoc;
  plan: PlanId;
  watermark: boolean;
  /** Where "back" goes; the demo points it at the landing page. */
  backHref?: string;
  backLabel?: string;
}

export function EditorShell({
  backend,
  title: initialTitle,
  revision,
  overlay,
  plan,
  watermark,
  backHref,
  backLabel,
}: EditorShellProps) {
  const t = useT();
  const dialog = useDialog();
  const [state, dispatch] = useReducer(editorReducer, overlay, createInitialState);
  const [title, setTitle] = useState(initialTitle);
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'error' | 'info'; message: string } | null>(
    backend.notice ? { tone: 'info', message: backend.notice } : null,
  );
  const [signatureOpen, setSignatureOpen] = useState(false);

  // The scrolling viewport is kept in state, not a ref: the page observer needs
  // it as its root, and a ref read during render is null on the first pass.
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pageRefs = useRef(new Map<number, HTMLDivElement>());

  const pdf = usePdfDocument(backend.pdfUrl);

  // Bitmap resolution is stepped, so small zoom changes do not re-rasterise.
  const renderScale = useMemo(() => {
    const dpr = typeof window === 'undefined' ? 1 : Math.min(2, window.devicePixelRatio || 1);
    return Math.min(3, Math.max(1, Math.ceil(state.zoom * dpr * 2) / 2));
  }, [state.zoom]);

  const activePageState = state.overlay.pages[state.activePage];
  const selection = useMemo(
    () => state.overlay.elements.filter((element) => state.selection.includes(element.id)),
    [state.overlay.elements, state.selection],
  );
  const pageElements = useMemo(
    () => state.overlay.elements.filter((element) => element.page === state.activePage),
    [state.overlay.elements, state.activePage],
  );
  const elementCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const element of state.overlay.elements) {
      counts[element.page] = (counts[element.page] ?? 0) + 1;
    }
    return counts;
  }, [state.overlay.elements]);

  // --- Persistence, zoom and shortcuts -------------------------------------

  const reportError = useCallback((message: string) => {
    setNotice({ tone: 'error', message });
  }, []);

  const { save, saving, savedAt, markSaved, setRevision } = useAutosave({
    backend,
    state,
    dispatch,
    revision,
    onError: reportError,
  });

  const { fitMode, toggleFit } = useZoomFit({
    pages: state.overlay.pages,
    activePage: state.activePage,
    container: scrollEl,
    dispatch,
  });

  const pickImage = useCallback(() => fileInputRef.current?.click(), []);
  const openSignaturePad = useCallback(() => setSignatureOpen(true), []);

  useEditorShortcuts({
    state,
    dispatch,
    selection,
    save,
    pickImage,
    openSignaturePad,
  });

  const jumpToPage = useCallback((index: number) => {
    dispatch({ type: 'activePage', page: index });
    pageRefs.current.get(index)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // --- Images --------------------------------------------------------------

  async function handleImageFile(file: File) {
    try {
      const prepared = await prepareImage(file);
      const result = await backend.uploadAsset({
        file: prepared.file,
        width: prepared.width,
        height: prepared.height,
      });

      const page = state.overlay.pages[state.activePage];
      if (!page) return;
      dispatch({
        type: 'add',
        element: createImageElement({
          page: state.activePage,
          assetId: result.assetId,
          naturalWidth: prepared.width,
          naturalHeight: prepared.height,
          pageState: page,
        }),
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof ApiError ? error.message : t('shell.addImageFailed'),
      });
    }
  }

  // --- Export --------------------------------------------------------------

  async function handleExport() {
    setExporting(true);
    setNotice(null);
    try {
      const { blob, skippedAssets: skipped } = await backend.exportPdf({
        overlay: state.overlay,
        title,
      });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `${title.replace(/[\\/:*?"<>|]+/g, '_') || 'medf-export'}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      markSaved(state.overlay);
      setNotice({
        tone: 'info',
        message:
          skipped > 0
            ? t('shell.exportSkipped', { count: skipped })
            : watermark
              ? t('shell.exportWatermarked')
              : t('shell.exportDone'),
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof ApiError ? error.message : t('shell.exportFailed'),
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleRename() {
    const next = await dialog.prompt({
      title: t('shell.renameTitle'),
      label: t('shell.renameLabel'),
      defaultValue: title,
      confirmLabel: t('shell.renameSave'),
    });
    if (!next || next.trim() === '' || next === title) return;
    try {
      const result = await backend.rename(next.trim());
      setTitle(result.title);
      setRevision(result.revision);
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof ApiError ? error.message : t('shell.renameFailed'),
      });
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-ink-100">
      <Toolbar
        title={title}
        dirty={state.dirty}
        saving={saving}
        exporting={exporting}
        savedAt={savedAt}
        tool={state.tool}
        zoom={state.zoom}
        canUndo={state.past.length > 0}
        canRedo={state.future.length > 0}
        dispatch={dispatch}
        onPickImage={() => fileInputRef.current?.click()}
        onDrawSignature={() => setSignatureOpen(true)}
        onSave={() => void save()}
        onExport={() => void handleExport()}
        onRename={() => void handleRename()}
        backHref={backHref}
        backLabel={backLabel}
        onFit={toggleFit}
        fitMode={fitMode}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleImageFile(file);
          event.target.value = '';
        }}
      />

      {notice ? (
        <div
          role="status"
          className={`flex items-center gap-2 px-4 py-2 text-sm ${
            notice.tone === 'error'
              ? 'bg-rose-50 text-rose-700'
              : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          <Icon name={notice.tone === 'error' ? 'x' : 'check-circle'} size={16} />
          <span className="flex-1">{notice.message}</span>
          {notice.tone === 'error' && plan === 'free' ? (
            <a href="/app/billing" className="font-semibold underline">
              {t('shell.seePlans')}
            </a>
          ) : null}
          <button type="button" onClick={() => setNotice(null)} aria-label={t('common.close')}>
            <Icon name="x" size={15} />
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <PagesPanel
          pages={state.overlay.pages}
          activePage={state.activePage}
          elementCounts={elementCounts}
          dispatch={dispatch}
          pdf={pdf.document}
          onJump={jumpToPage}
        />

        <div
          ref={setScrollEl}
          className="editor-backdrop min-w-0 flex-1 overflow-auto p-6"
        >
          {pdf.loading ? (
            <div className="flex h-full items-center justify-center gap-3 text-ink-600">
              <Spinner size={20} />
              {t('shell.loadingPdf')}
            </div>
          ) : pdf.error ? (
            <div className="mx-auto max-w-md rounded-xl border border-rose-200 bg-white p-6 text-center">
              <p className="font-semibold text-rose-700">{pdf.error}</p>
              <p className="mt-2 text-sm text-ink-500">
                {t('shell.pdfFailedHint')}
              </p>
            </div>
          ) : (
            <div
              className="mx-auto flex flex-col items-center"
              style={{ gap: PAGE_GAP }}
            >
              {state.overlay.pages.map((page, index) => (
                <PageSlot
                  key={`${page.source}-${index}`}
                  index={index}
                  register={(node) => {
                    if (node) pageRefs.current.set(index, node);
                    else pageRefs.current.delete(index);
                  }}
                  root={scrollEl}
                >
                  {(visible) => (
                    <>
                      <div className="mb-1.5 text-center text-[11px] font-medium text-ink-500">
                        {t('shell.pageOf', {
                          number: index + 1,
                          total: state.overlay.pages.length,
                        })}
                      </div>
                      <PageStage
                        page={page}
                        pageIndex={index}
                        elements={state.overlay.elements.filter(
                          (element) => element.page === index,
                        )}
                        zoom={state.zoom}
                        tool={state.tool}
                        selection={state.selection}
                        editingId={state.editingId}
                        guides={state.activePage === index ? state.guides : []}
                        dispatch={dispatch}
                        pdf={pdf.document}
                        renderScale={renderScale}
                        active={visible}
                        assetUrl={backend.assetUrl}
                      />
                    </>
                  )}
                </PageSlot>
              ))}
            </div>
          )}
        </div>

        <PropertiesPanel
          selection={selection}
          pageElements={pageElements}
          page={activePageState}
          pageIndex={state.activePage}
          dispatch={dispatch}
        />
      </div>

      {signatureOpen ? (
        <SignaturePad
          onCancel={() => setSignatureOpen(false)}
          onConfirm={(result) => {
            setSignatureOpen(false);
            const page = state.overlay.pages[state.activePage];
            if (!page) return;
            dispatch({
              type: 'add',
              element: createSignatureElement({
                page: state.activePage,
                strokes: result.strokes,
                color: result.color,
                strokeWidth: result.strokeWidth,
                ratio: result.ratio,
                pageState: page,
              }),
            });
          }}
        />
      ) : null}

      {dialog.element}
    </div>
  );
}

/** Wraps a page so it only rasterises when it is near the viewport. */
function PageSlot({
  index,
  register,
  root,
  children,
}: {
  index: number;
  register: (node: HTMLDivElement | null) => void;
  root: HTMLElement | null;
  children: (visible: boolean) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const visible = useInView(ref, { root, rootMargin: '1200px' });

  return (
    <div
      ref={(node) => {
        ref.current = node;
        register(node);
      }}
      data-page-slot={index}
    >
      {children(visible)}
    </div>
  );
}

/**
 * Normalises an image for the export pipeline: pdf-lib can embed PNG and JPEG
 * only, so anything else is re-encoded to PNG in the browser.
 */
async function prepareImage(
  file: File,
): Promise<{ file: File; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  if (file.type === 'image/png' || file.type === 'image/jpeg') {
    bitmap.close();
    return { file, width, height };
  }

  const canvas = window.document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot convert the image');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) throw new Error('Could not convert the image to PNG');

  return {
    file: new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.png`, { type: 'image/png' }),
    width,
    height,
  };
}
