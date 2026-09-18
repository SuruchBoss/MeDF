'use client';

import { type Dispatch, useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { type AnyElement, FONT_CSS, type PageState } from '@/lib/editor-types';
import { ElementView } from './element-view';
import { createElement } from './factories';
import {
  type Box,
  HANDLE_CURSOR,
  HANDLE_ORIGIN,
  HANDLES,
  type Handle,
  boxesIntersect,
  resizeBox,
  round,
  snapAngle,
  snapBox,
} from './geometry';
import { PdfPageCanvas } from './pdf-page-canvas';
import {
  type EditorAction,
  type Guide,
  type Tool,
  rotatedPageSize,
  toBaseSpace,
} from './store';

/**
 * One page of the document: the rendered PDF, the overlay elements on top, and
 * every pointer gesture (place, drag, resize, rotate, marquee-select).
 *
 * Layers, outside in:
 *   `pageBox`   — rotated page box, sized in screen pixels
 *     `rotator` — applies the member's page rotation
 *       `scaler`    — `scale(zoom)`; children use base page units (1 unit = 1 pt)
 *       `chrome`    — selection outlines, handles and guides, in screen pixels
 *                     so they keep a constant size at any zoom
 */

type Gesture =
  | {
      kind: 'drag';
      start: { x: number; y: number };
      origins: Map<string, { x: number; y: number }>;
      moved: boolean;
    }
  | {
      kind: 'resize';
      id: string;
      handle: Handle;
      start: { x: number; y: number };
      origin: Box;
      rotation: number;
    }
  | {
      kind: 'rotate';
      id: string;
      centre: { x: number; y: number };
      startAngle: number;
      originRotation: number;
    }
  | {
      kind: 'endpoint';
      id: string;
      which: 'from' | 'to';
    }
  | {
      kind: 'marquee';
      start: { x: number; y: number };
      additive: boolean;
    };

interface PageStageProps {
  page: PageState;
  pageIndex: number;
  elements: AnyElement[];
  zoom: number;
  tool: Tool;
  selection: string[];
  editingId: string | null;
  guides: Guide[];
  dispatch: Dispatch<EditorAction>;
  pdf: PDFDocumentProxy | null;
  renderScale: number;
  active: boolean;
  /** Resolves an image element's asset to a renderable URL. */
  assetUrl: (assetId: string) => string;
  onPlaced?: () => void;
}

export function PageStage({
  page,
  pageIndex,
  elements,
  zoom,
  tool,
  selection,
  editingId,
  guides,
  dispatch,
  pdf,
  renderScale,
  active,
  assetUrl,
  onPlaced,
}: PageStageProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const rotated = rotatedPageSize(page);

  /**
   * The window listeners below are attached once per mount. They read the live
   * page, zoom, elements and marquee from here instead of from their closure,
   * because those values change on every pointer move — re-subscribing three
   * listeners per frame would make dragging noticeably worse on long documents.
   */
  const liveRef = useRef({ page, zoom, elements, marquee });
  useEffect(() => {
    liveRef.current = { page, zoom, elements, marquee };
  });

  /** Pointer position in base page space. */
  const pointToBase = useCallback(
    (event: { clientX: number; clientY: number }) => {
      const rect = boxRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const { page: livePage, zoom: liveZoom } = liveRef.current;
      const u = (event.clientX - rect.left) / liveZoom;
      const v = (event.clientY - rect.top) / liveZoom;
      return toBaseSpace(u, v, livePage);
    },
    [],
  );

  const endGesture = useCallback(() => {
    gestureRef.current = null;
    setMarquee(null);
    dispatch({ type: 'guides', guides: [] });
  }, [dispatch]);

  // A single window-level move/up listener pair drives every gesture, so a
  // drag keeps working when the pointer leaves the page box.
  useEffect(() => {
    function handleMove(event: PointerEvent) {
      const gesture = gestureRef.current;
      if (!gesture) return;
      event.preventDefault();

      const { page: livePage, zoom: liveZoom, elements: liveElements } = liveRef.current;
      const point = pointToBase(event);

      if (gesture.kind === 'marquee') {
        const box = {
          x: Math.min(gesture.start.x, point.x),
          y: Math.min(gesture.start.y, point.y),
          w: Math.abs(point.x - gesture.start.x),
          h: Math.abs(point.y - gesture.start.y),
        };
        setMarquee(box);
        return;
      }

      if (gesture.kind === 'drag') {
        const rawDx = point.x - gesture.start.x;
        const rawDy = point.y - gesture.start.y;

        const moving = liveElements.filter((element) => gesture.origins.has(element.id));
        if (moving.length === 0) return;

        const first = moving[0];
        const origin = gesture.origins.get(first.id)!;
        const provisional: Box = {
          x: origin.x + rawDx,
          y: origin.y + rawDy,
          w: first.w,
          h: first.h,
        };
        const snap = event.altKey
          ? { dx: 0, dy: 0, guides: [] }
          : snapBox({
              box: provisional,
              pageWidth: livePage.width,
              pageHeight: livePage.height,
              others: liveElements.filter((element) => !gesture.origins.has(element.id)),
              threshold: 6 / liveZoom,
            });

        const dx = rawDx + snap.dx;
        const dy = rawDy + snap.dy;
        gesture.moved = Math.abs(rawDx) > 0.5 || Math.abs(rawDy) > 0.5;

        for (const element of moving) {
          const start = gesture.origins.get(element.id)!;
          dispatch({
            type: 'updateOne',
            id: element.id,
            patch: { x: round(start.x + dx), y: round(start.y + dy) },
            history: false,
          });
        }
        dispatch({ type: 'guides', guides: snap.guides });
        return;
      }

      if (gesture.kind === 'resize') {
        const next = resizeBox({
          origin: gesture.origin,
          rotation: gesture.rotation,
          handle: gesture.handle,
          dx: point.x - gesture.start.x,
          dy: point.y - gesture.start.y,
          keepRatio: event.shiftKey,
        });
        dispatch({ type: 'updateOne', id: gesture.id, patch: next, history: false });
        return;
      }

      if (gesture.kind === 'rotate') {
        const angle =
          (Math.atan2(point.y - gesture.centre.y, point.x - gesture.centre.x) * 180) / Math.PI;
        const rotation = snapAngle(
          gesture.originRotation + (angle - gesture.startAngle),
          event.shiftKey,
        );
        dispatch({ type: 'updateOne', id: gesture.id, patch: { rotation }, history: false });
        return;
      }

      if (gesture.kind === 'endpoint') {
        const element = liveElements.find((candidate) => candidate.id === gesture.id);
        if (!element || element.type !== 'line') return;
        const fx = Math.max(-0.5, Math.min(1.5, (point.x - element.x) / element.w));
        const fy = Math.max(-0.5, Math.min(1.5, (point.y - element.y) / element.h));
        dispatch({
          type: 'updateOne',
          id: element.id,
          patch: {
            [gesture.which]: [round(fx * 100) / 100, round(fy * 100) / 100],
          } as Partial<AnyElement>,
          history: false,
        });
      }
    }

    function handleUp() {
      const gesture = gestureRef.current;
      const { elements: liveElements, marquee: liveMarquee } = liveRef.current;
      if (gesture?.kind === 'marquee' && liveMarquee) {
        const hits = liveElements
          .filter((element) => !element.locked && boxesIntersect(liveMarquee, element))
          .map((element) => element.id);
        dispatch({ type: 'select', ids: hits, additive: gesture.additive });
      }
      endGesture();
    }

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [dispatch, endGesture, pointToBase]);

  function handleBackgroundPointerDown(event: React.PointerEvent) {
    if (event.button !== 0) return;
    const point = pointToBase(event);

    if (tool !== 'select') {
      if (tool === 'image' || tool === 'draw') return; // handled by the toolbar
      dispatch({
        type: 'add',
        element: createElement({ type: tool, page: pageIndex, x: point.x, y: point.y }),
      });
      onPlaced?.();
      return;
    }

    dispatch({ type: 'activePage', page: pageIndex });
    if (!event.shiftKey) dispatch({ type: 'select', ids: [] });
    gestureRef.current = { kind: 'marquee', start: point, additive: event.shiftKey };
    setMarquee({ x: point.x, y: point.y, w: 0, h: 0 });
  }

  function handleElementPointerDown(event: React.PointerEvent, element: AnyElement) {
    if (event.button !== 0 || tool !== 'select') return;
    event.stopPropagation();
    dispatch({ type: 'activePage', page: pageIndex });

    const alreadySelected = selection.includes(element.id);
    if (event.shiftKey) {
      dispatch({ type: 'select', ids: [element.id], additive: true });
      return;
    }
    if (!alreadySelected) dispatch({ type: 'select', ids: [element.id] });
    if (element.locked) return;

    const ids = alreadySelected ? selection : [element.id];
    const origins = new Map<string, { x: number; y: number }>();
    for (const candidate of elements) {
      if (ids.includes(candidate.id) && !candidate.locked) {
        origins.set(candidate.id, { x: candidate.x, y: candidate.y });
      }
    }
    dispatch({ type: 'checkpoint' });
    gestureRef.current = { kind: 'drag', start: pointToBase(event), origins, moved: false };
  }

  function handleResizePointerDown(event: React.PointerEvent, element: AnyElement, handle: Handle) {
    event.stopPropagation();
    if (element.locked) return;
    dispatch({ type: 'checkpoint' });
    gestureRef.current = {
      kind: 'resize',
      id: element.id,
      handle,
      start: pointToBase(event),
      origin: { x: element.x, y: element.y, w: element.w, h: element.h },
      rotation: element.rotation,
    };
  }

  function handleRotatePointerDown(event: React.PointerEvent, element: AnyElement) {
    event.stopPropagation();
    if (element.locked) return;
    const centre = { x: element.x + element.w / 2, y: element.y + element.h / 2 };
    const point = pointToBase(event);
    dispatch({ type: 'checkpoint' });
    gestureRef.current = {
      kind: 'rotate',
      id: element.id,
      centre,
      startAngle: (Math.atan2(point.y - centre.y, point.x - centre.x) * 180) / Math.PI,
      originRotation: element.rotation,
    };
  }

  function handleEndpointPointerDown(
    event: React.PointerEvent,
    element: AnyElement,
    which: 'from' | 'to',
  ) {
    event.stopPropagation();
    if (element.locked) return;
    dispatch({ type: 'checkpoint' });
    gestureRef.current = { kind: 'endpoint', id: element.id, which };
  }

  const placing = tool !== 'select';

  return (
    <div
      ref={boxRef}
      data-page-index={pageIndex}
      className="relative shrink-0 shadow-xl shadow-ink-900/15 ring-1 ring-ink-900/10"
      style={{
        width: rotated.width * zoom,
        height: rotated.height * zoom,
        cursor: placing ? 'crosshair' : 'default',
      }}
      onPointerDown={handleBackgroundPointerDown}
    >
      {/* Rotation wrapper */}
      <div
        className="absolute top-1/2 left-1/2"
        style={{
          width: page.width * zoom,
          height: page.height * zoom,
          transform: `translate(-50%, -50%) rotate(${page.rotation}deg)`,
        }}
      >
        {/* Base-unit content */}
        <div
          className="absolute top-0 left-0 origin-top-left bg-white"
          style={{
            width: page.width,
            height: page.height,
            transform: `scale(${zoom})`,
          }}
        >
          <PdfPageCanvas
            pdf={pdf}
            sourceIndex={page.source}
            width={page.width}
            height={page.height}
            renderScale={renderScale}
            active={active}
          />

          {elements.map((element) => {
            const isEditing = editingId === element.id;
            return (
              <div
                key={element.id}
                data-element-id={element.id}
                className="absolute"
                style={{
                  left: element.x,
                  top: element.y,
                  width: element.w,
                  height: element.h,
                  transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
                  transformOrigin: 'center',
                  opacity: element.opacity,
                  cursor: element.locked ? 'not-allowed' : placing ? 'crosshair' : 'move',
                  touchAction: 'none',
                }}
                onPointerDown={(event) => handleElementPointerDown(event, element)}
                onDoubleClick={(event) => {
                  if (element.type !== 'text' || element.locked) return;
                  event.stopPropagation();
                  dispatch({ type: 'editing', id: element.id });
                }}
              >
                <ElementView element={element} editing={isEditing} assetUrl={assetUrl} />

                {isEditing && element.type === 'text' ? (
                  <textarea
                    autoFocus
                    value={element.text}
                    onChange={(event) =>
                      dispatch({
                        type: 'updateOne',
                        id: element.id,
                        patch: { text: event.target.value } as Partial<AnyElement>,
                        history: false,
                      })
                    }
                    onBlur={() => dispatch({ type: 'editing', id: null })}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        dispatch({ type: 'editing', id: null });
                      }
                      // Let every other key reach the textarea, not the canvas.
                      event.stopPropagation();
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    className="absolute inset-0 resize-none border-0 bg-white/85 outline-none"
                    style={{
                      padding: element.padding,
                      fontFamily: FONT_CSS[element.fontFamily],
                      fontSize: element.fontSize,
                      lineHeight: element.lineHeight,
                      color: element.color,
                      textAlign: element.align,
                      fontWeight: element.bold ? 700 : 400,
                      fontStyle: element.italic ? 'italic' : 'normal',
                      overflow: 'hidden',
                    }}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Selection chrome, in screen pixels */}
        <div className="pointer-events-none absolute inset-0 overflow-visible">
          {guides.map((guide) => (
            <div
              key={`${guide.axis}-${guide.at}`}
              className="absolute bg-fuchsia-500/80"
              style={
                guide.axis === 'x'
                  ? { left: guide.at * zoom, top: 0, width: 1, height: '100%' }
                  : { top: guide.at * zoom, left: 0, height: 1, width: '100%' }
              }
            />
          ))}

          {elements
            .filter((element) => selection.includes(element.id))
            // The handlers passed below write `gestureRef` from pointer
            // callbacks only; no ref is read while rendering.
            // eslint-disable-next-line react-hooks/refs
            .map((element) => {
              const single = selection.length === 1;
              return (
                <div
                  key={element.id}
                  className="absolute"
                  style={{
                    left: element.x * zoom,
                    top: element.y * zoom,
                    width: element.w * zoom,
                    height: element.h * zoom,
                    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
                    transformOrigin: 'center',
                  }}
                >
                  <div
                    className={`absolute inset-0 border-2 ${
                      element.locked ? 'border-amber-500' : 'border-brand-500'
                    }`}
                  />

                  {single && !element.locked ? (
                    <>
                      {/* Rotation handle */}
                      <div
                        className="pointer-events-auto absolute left-1/2 flex -translate-x-1/2 items-center justify-center"
                        style={{ top: -26, width: 18, height: 18, cursor: 'grab' }}
                        onPointerDown={(event) => handleRotatePointerDown(event, element)}
                        title="หมุน (กด Shift เพื่อหมุนทีละ 15°)"
                      >
                        <span className="h-3.5 w-3.5 rounded-full border-2 border-brand-600 bg-white" />
                      </div>
                      <div
                        className="absolute left-1/2 w-px bg-brand-500"
                        style={{ top: -12, height: 12 }}
                      />

                      {HANDLES.map((handle) => {
                        const origin = HANDLE_ORIGIN[handle];
                        return (
                          <span
                            key={handle}
                            className="selection-handle pointer-events-auto"
                            style={{
                              left: `calc(${origin.fx * 100}% - 5.5px)`,
                              top: `calc(${origin.fy * 100}% - 5.5px)`,
                              cursor: HANDLE_CURSOR[handle],
                            }}
                            onPointerDown={(event) =>
                              handleResizePointerDown(event, element, handle)
                            }
                          />
                        );
                      })}

                      {element.type === 'line'
                        ? (['from', 'to'] as const).map((which) => {
                            const point = element[which];
                            return (
                              <span
                                key={which}
                                className="pointer-events-auto absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-fuchsia-600 bg-white"
                                style={{
                                  left: point[0] * element.w * zoom,
                                  top: point[1] * element.h * zoom,
                                  cursor: 'crosshair',
                                }}
                                onPointerDown={(event) =>
                                  handleEndpointPointerDown(event, element, which)
                                }
                                title="ลากเพื่อย้ายปลายเส้น"
                              />
                            );
                          })
                        : null}
                    </>
                  ) : null}
                </div>
              );
            })}

          {marquee ? (
            <div
              className="absolute border border-brand-500 bg-brand-500/10"
              style={{
                left: marquee.x * zoom,
                top: marquee.y * zoom,
                width: marquee.w * zoom,
                height: marquee.h * zoom,
              }}
            />
          ) : null}
        </div>
      </div>

      {page.hidden ? (
        <div className="absolute inset-0 flex items-center justify-center bg-ink-900/55">
          <span className="badge bg-white text-ink-700">หน้านี้ถูกซ่อน — จะไม่อยู่ในไฟล์ที่ export</span>
        </div>
      ) : null}
    </div>
  );
}
