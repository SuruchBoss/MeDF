'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { Icon, Spinner } from '@/components/icons';
import { ApiError } from '@/lib/client/fetcher';
import type { OverlayDoc } from '@/lib/editor-types';
import type { PlanId } from '@/lib/plans';
import type { EditorBackend } from './backend';
import { createImageElement, createSignatureElement } from './factories';
import { PagesPanel } from './pages-panel';
import { PageStage } from './page-stage';
import { PropertiesPanel } from './properties-panel';
import { SignaturePad } from './signature-pad';
import {
  type EditorAction,
  createInitialState,
  editorReducer,
  rotatedPageSize,
} from './store';
import { Toolbar } from './toolbar';
import { usePdfDocument } from './use-pdf';
import { useInView } from './use-in-view';

/**
 * The editor. Owns document state, autosave, keyboard shortcuts, asset uploads
 * and export; the child components stay presentational.
 *
 * Everything that leaves the browser goes through `backend`, so the same
 * editor drives the real product and the browser-only demo.
 */

const AUTOSAVE_DELAY = 1200;
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
  const [state, dispatch] = useReducer(editorReducer, overlay, createInitialState);
  const [title, setTitle] = useState(initialTitle);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'info'; message: string } | null>(
    backend.notice ? { tone: 'info', message: backend.notice } : null,
  );
  const [signatureOpen, setSignatureOpen] = useState(false);

  const revisionRef = useRef(revision);
  const savedOverlayRef = useRef<OverlayDoc>(state.overlay);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  // Kept in state as well: the page observer needs the container as its root,
  // and a ref read during render would always be null on the first pass.
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

  // --- Persistence ---------------------------------------------------------

  const save = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const snapshot = state.overlay;
      if (snapshot === savedOverlayRef.current) return;

      setSaving(true);
      try {
        const result = await backend.saveOverlay({
          overlay: snapshot,
          baseRevision: revisionRef.current,
        });
        revisionRef.current = result.revision;
        savedOverlayRef.current = snapshot;
        setSavedAt(new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }));
        // Only clear the dirty flag when nothing changed while saving.
        if (snapshot === state.overlay) dispatch({ type: 'saved' });
      } catch (error) {
        const message = error instanceof ApiError ? error.message : 'บันทึกไม่สำเร็จ';
        if (!options.silent || error instanceof ApiError) {
          setNotice({ tone: 'error', message });
        }
      } finally {
        setSaving(false);
      }
    },
    [backend, state.overlay],
  );

  useEffect(() => {
    if (!state.dirty) return;
    const timer = window.setTimeout(() => void save({ silent: true }), AUTOSAVE_DELAY);
    return () => window.clearTimeout(timer);
  }, [state.dirty, state.overlay, save]);

  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (!state.dirty) return;
      event.preventDefault();
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [state.dirty]);

  // --- Zoom to fit ---------------------------------------------------------

  /**
   * Zoom presets. Opening a document shows a whole page (that is what members
   * expect from a PDF tool); the percentage button then toggles to fit-width.
   */
  const fitTo = useCallback(
    (mode: 'page' | 'width') => {
      const container = scrollRef.current;
      const page = state.overlay.pages[state.activePage] ?? state.overlay.pages[0];
      if (!container || !page) return;
      const size = rotatedPageSize(page);
      const byWidth = (container.clientWidth - 72) / size.width;
      // Leave room for the page label and the gap between pages.
      const byHeight = (container.clientHeight - 64) / size.height;
      const zoom = mode === 'width' ? byWidth : Math.min(byWidth, byHeight);
      dispatch({ type: 'zoom', zoom: Math.max(0.2, Math.min(2.5, zoom)) });
    },
    [state.overlay.pages, state.activePage],
  );

  const [fitMode, setFitMode] = useState<'page' | 'width'>('page');
  const toggleFit = useCallback(() => {
    const next = fitMode === 'page' ? 'width' : 'page';
    setFitMode(next);
    fitTo(next);
  }, [fitMode, fitTo]);

  useEffect(() => {
    // Fit once the first render has measured the container.
    const timer = window.setTimeout(() => fitTo('page'), 60);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const jumpToPage = useCallback((index: number) => {
    dispatch({ type: 'activePage', page: index });
    pageRefs.current.get(index)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // --- Keyboard shortcuts --------------------------------------------------

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (state.editingId) return;

      const meta = event.ctrlKey || event.metaKey;

      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? 'redo' : 'undo' });
        return;
      }
      if (meta && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        dispatch({ type: 'redo' });
        return;
      }
      if (meta && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
        return;
      }
      if (meta && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        dispatch({ type: 'duplicate' });
        return;
      }
      if (meta && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        dispatch({ type: 'selectAllOnPage' });
        return;
      }
      if (meta && (event.key === '+' || event.key === '=')) {
        event.preventDefault();
        dispatch({ type: 'zoom', zoom: state.zoom + 0.1 });
        return;
      }
      if (meta && event.key === '-') {
        event.preventDefault();
        dispatch({ type: 'zoom', zoom: state.zoom - 0.1 });
        return;
      }
      if (meta && event.key === ']') {
        event.preventDefault();
        for (const element of selection) dispatch({ type: 'reorder', id: element.id, to: 'front' });
        return;
      }
      if (meta && event.key === '[') {
        event.preventDefault();
        for (const element of selection) dispatch({ type: 'reorder', id: element.id, to: 'back' });
        return;
      }
      if (meta) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (state.selection.length === 0) return;
        event.preventDefault();
        dispatch({ type: 'delete' });
        return;
      }
      if (event.key === 'Escape') {
        dispatch({ type: 'select', ids: [] });
        dispatch({ type: 'tool', tool: 'select' });
        return;
      }
      if (event.key.startsWith('Arrow') && state.selection.length > 0) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx = event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0;
        const dy = event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0;
        dispatch({ type: 'checkpoint' });
        for (const element of selection) {
          dispatch({
            type: 'updateOne',
            id: element.id,
            patch: { x: element.x + dx, y: element.y + dy },
            history: false,
          });
        }
        return;
      }

      const shortcuts: Record<string, EditorAction> = {
        v: { type: 'tool', tool: 'select' },
        t: { type: 'tool', tool: 'text' },
        r: { type: 'tool', tool: 'rect' },
        o: { type: 'tool', tool: 'ellipse' },
        l: { type: 'tool', tool: 'line' },
        h: { type: 'tool', tool: 'highlight' },
        k: { type: 'tool', tool: 'check' },
      };
      const action = shortcuts[event.key.toLowerCase()];
      if (action) {
        event.preventDefault();
        dispatch(action);
        return;
      }
      if (event.key.toLowerCase() === 'i') {
        event.preventDefault();
        fileInputRef.current?.click();
      }
      if (event.key.toLowerCase() === 's') {
        event.preventDefault();
        setSignatureOpen(true);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [save, selection, state.editingId, state.selection.length, state.zoom]);

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
        message: error instanceof ApiError ? error.message : 'เพิ่มรูปภาพไม่สำเร็จ',
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

      revisionRef.current += 1;
      savedOverlayRef.current = state.overlay;
      dispatch({ type: 'saved' });
      setNotice({
        tone: 'info',
        message:
          skipped > 0
            ? `Export สำเร็จ แต่มีรูปภาพ ${skipped} รูปที่โหลดไม่ได้และถูกข้ามไป`
            : watermark
              ? 'Export สำเร็จ — ไฟล์นี้มีลายน้ำ MeDF (อัปเกรดเพื่อลบออก)'
              : 'Export สำเร็จ ไฟล์ถูกดาวน์โหลดแล้ว',
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof ApiError ? error.message : 'Export ไม่สำเร็จ',
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleRename() {
    const next = window.prompt('ตั้งชื่อเอกสาร', title);
    if (!next || next.trim() === '' || next === title) return;
    try {
      const result = await backend.rename(next.trim());
      setTitle(result.title);
      revisionRef.current = result.revision;
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof ApiError ? error.message : 'เปลี่ยนชื่อไม่สำเร็จ',
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
              ดูแพ็กเกจ
            </a>
          ) : null}
          <button type="button" onClick={() => setNotice(null)} aria-label="ปิด">
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
          ref={(node) => {
            scrollRef.current = node;
            setScrollEl(node);
          }}
          className="editor-backdrop min-w-0 flex-1 overflow-auto p-6"
        >
          {pdf.loading ? (
            <div className="flex h-full items-center justify-center gap-3 text-ink-600">
              <Spinner size={20} />
              กำลังเปิดไฟล์ PDF…
            </div>
          ) : pdf.error ? (
            <div className="mx-auto max-w-md rounded-xl border border-rose-200 bg-white p-6 text-center">
              <p className="font-semibold text-rose-700">{pdf.error}</p>
              <p className="mt-2 text-sm text-ink-500">
                ลองรีเฟรชหน้านี้ หรือกลับไปอัปโหลดไฟล์ใหม่อีกครั้ง
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
                        หน้า {index + 1} / {state.overlay.pages.length}
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
  if (!context) throw new Error('เบราว์เซอร์นี้ไม่รองรับการแปลงรูปภาพ');
  context.drawImage(bitmap, 0, 0);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png'),
  );
  if (!blob) throw new Error('แปลงรูปภาพเป็น PNG ไม่สำเร็จ');

  return {
    file: new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.png`, { type: 'image/png' }),
    width,
    height,
  };
}
