'use client';

import { type Dispatch, useCallback, useEffect, useRef, useState } from 'react';
import type { PageState } from '@/lib/editor-types';
import { type EditorAction, rotatedPageSize } from './store';

/**
 * Zoom presets.
 *
 * Opening a document shows a whole page, which is what members expect from a
 * PDF tool; the percentage button then toggles to fit-width and back.
 */

/** Room for the page label above and the gap between pages. */
const CHROME_WIDTH = 72;
const CHROME_HEIGHT = 64;

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;

export type FitMode = 'page' | 'width';

export function useZoomFit({
  pages,
  activePage,
  container,
  dispatch,
}: {
  pages: PageState[];
  activePage: number;
  /** The scrolling viewport; null until the first render has measured it. */
  container: HTMLElement | null;
  dispatch: Dispatch<EditorAction>;
}) {
  const [fitMode, setFitMode] = useState<FitMode>('page');

  const fitTo = useCallback(
    (mode: FitMode) => {
      const page = pages[activePage] ?? pages[0];
      if (!container || !page) return;
      const size = rotatedPageSize(page);
      const byWidth = (container.clientWidth - CHROME_WIDTH) / size.width;
      const byHeight = (container.clientHeight - CHROME_HEIGHT) / size.height;
      const zoom = mode === 'width' ? byWidth : Math.min(byWidth, byHeight);
      dispatch({ type: 'zoom', zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom)) });
    },
    [activePage, container, dispatch, pages],
  );

  const toggleFit = useCallback(() => {
    const next: FitMode = fitMode === 'page' ? 'width' : 'page';
    setFitMode(next);
    fitTo(next);
  }, [fitMode, fitTo]);

  // Fit a whole page as soon as the viewport exists to measure, and only then.
  // The latch is a ref rather than state because it changes nothing on screen —
  // and because `fitTo` changes identity with the page, so this effect re-runs.
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || !container) return;
    fitted.current = true;
    fitTo('page');
  }, [container, fitTo]);

  return { fitTo, fitMode, toggleFit };
}
