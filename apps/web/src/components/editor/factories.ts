'use client';

import type { AnyElement, ElementType, PageState } from '@/lib/editor-types';
import { createElementId } from './store';

/**
 * Default geometry and styling for newly inserted elements.
 * Sizes are in PDF points, which is also the editor's CSS pixel unit at 100%
 * zoom — so what is authored at 16 pt exports at exactly 16 pt.
 */

interface CreateOptions {
  type: Exclude<ElementType, 'image' | 'draw'>;
  page: number;
  /** Insertion point in base page space; the element is centred on it. */
  x: number;
  y: number;
}

const DEFAULT_SIZE: Record<ElementType, { w: number; h: number }> = {
  text: { w: 240, h: 44 },
  image: { w: 200, h: 150 },
  rect: { w: 180, h: 100 },
  ellipse: { w: 130, h: 130 },
  line: { w: 200, h: 24 },
  draw: { w: 220, h: 80 },
  highlight: { w: 220, h: 22 },
  check: { w: 30, h: 30 },
};

function base(type: ElementType, page: number, x: number, y: number) {
  const size = DEFAULT_SIZE[type];
  return {
    id: createElementId(),
    page,
    x: Math.round((x - size.w / 2) * 10) / 10,
    y: Math.round((y - size.h / 2) * 10) / 10,
    w: size.w,
    h: size.h,
    rotation: 0,
    opacity: 1,
    locked: false,
  };
}

export function createElement(options: CreateOptions): AnyElement {
  const { type, page, x, y } = options;
  const common = base(type, page, x, y);

  switch (type) {
    case 'text':
      return {
        ...common,
        type: 'text',
        text: 'พิมพ์ข้อความที่นี่',
        fontFamily: 'sarabun',
        fontSize: 16,
        bold: false,
        italic: false,
        underline: false,
        color: '#111827',
        align: 'left',
        lineHeight: 1.35,
        background: null,
        padding: 4,
      };
    case 'rect':
      return {
        ...common,
        type: 'rect',
        fill: '#ffffff',
        stroke: '#4f46e5',
        strokeWidth: 1.5,
        radius: 6,
      };
    case 'ellipse':
      return {
        ...common,
        type: 'ellipse',
        fill: null,
        stroke: '#dc2626',
        strokeWidth: 2,
      };
    case 'line':
      return {
        ...common,
        type: 'line',
        stroke: '#111827',
        strokeWidth: 2,
        arrowStart: false,
        arrowEnd: false,
        from: [0, 0.5],
        to: [1, 0.5],
      };
    case 'highlight':
      return { ...common, type: 'highlight', color: '#fde047' };
    case 'check':
      return { ...common, type: 'check', variant: 'check', color: '#16a34a', strokeWidth: 3 };
    default: {
      const exhaustive: never = type;
      throw new Error(`ไม่รู้จักชนิดองค์ประกอบ: ${String(exhaustive)}`);
    }
  }
}

export function createImageElement(options: {
  page: number;
  assetId: string;
  naturalWidth: number;
  naturalHeight: number;
  pageState: PageState;
}): AnyElement {
  const { pageState } = options;
  const ratio = options.naturalWidth / Math.max(1, options.naturalHeight);

  // Fit inside half the page, keeping the natural aspect ratio.
  const maxWidth = pageState.width * 0.5;
  const maxHeight = pageState.height * 0.5;
  let w = Math.min(options.naturalWidth, maxWidth);
  let h = w / ratio;
  if (h > maxHeight) {
    h = maxHeight;
    w = h * ratio;
  }

  return {
    id: createElementId(),
    type: 'image',
    page: options.page,
    x: Math.round((pageState.width - w) / 2),
    y: Math.round((pageState.height - h) / 2),
    w: Math.round(w),
    h: Math.round(h),
    rotation: 0,
    opacity: 1,
    locked: false,
    assetId: options.assetId,
    naturalRatio: ratio,
  };
}

export function createSignatureElement(options: {
  page: number;
  strokes: [number, number][][];
  color: string;
  strokeWidth: number;
  pageState: PageState;
  /** Aspect ratio of the drawing surface, so the signature is not distorted. */
  ratio: number;
}): AnyElement {
  const w = Math.min(240, options.pageState.width * 0.45);
  const h = Math.max(30, w / Math.max(0.2, options.ratio));

  return {
    id: createElementId(),
    type: 'draw',
    page: options.page,
    x: Math.round((options.pageState.width - w) / 2),
    y: Math.round(options.pageState.height * 0.7),
    w: Math.round(w),
    h: Math.round(h),
    rotation: 0,
    opacity: 1,
    locked: false,
    strokes: options.strokes,
    stroke: options.color,
    strokeWidth: options.strokeWidth,
  };
}

/** A white box, the quickest way to blank out text on the source page. */
export function createCoverElement(page: number, x: number, y: number): AnyElement {
  const element = createElement({ type: 'rect', page, x, y });
  return { ...element, type: 'rect', fill: '#ffffff', stroke: null, radius: 0 } as AnyElement;
}
