'use client';

import type { AnyElement } from '@/lib/editor-types';

/** Geometry helpers shared by the drag/resize/rotate gestures. */

export type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export const HANDLE_CURSOR: Record<Handle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

/** Handle position as a fraction of the element box. */
export const HANDLE_ORIGIN: Record<Handle, { fx: number; fy: number }> = {
  nw: { fx: 0, fy: 0 },
  n: { fx: 0.5, fy: 0 },
  ne: { fx: 1, fy: 0 },
  e: { fx: 1, fy: 0.5 },
  se: { fx: 1, fy: 1 },
  s: { fx: 0.5, fy: 1 },
  sw: { fx: 0, fy: 1 },
  w: { fx: 0, fy: 0.5 },
};

export const MIN_SIZE = 6;

function rotatePoint(x: number, y: number, degrees: number): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Resizes a (possibly rotated) box by dragging `handle` with the pointer
 * displaced by (dx, dy) in page space. The opposite edge stays visually put.
 */
export function resizeBox(options: {
  origin: Box;
  rotation: number;
  handle: Handle;
  dx: number;
  dy: number;
  keepRatio: boolean;
}): Box {
  const { origin, rotation, handle, keepRatio } = options;

  // Work in the element's own (unrotated) frame.
  const local = rotatePoint(options.dx, options.dy, -rotation);
  const west = handle.includes('w');
  const east = handle.includes('e');
  const north = handle.includes('n');
  const south = handle.includes('s');

  let w = origin.w + (east ? local.x : 0) - (west ? local.x : 0);
  let h = origin.h + (south ? local.y : 0) - (north ? local.y : 0);

  w = Math.max(MIN_SIZE, w);
  h = Math.max(MIN_SIZE, h);

  if (keepRatio && (west || east) && (north || south)) {
    const ratio = origin.w / origin.h;
    // Follow whichever axis moved more, so the drag feels natural.
    if (Math.abs(w - origin.w) > Math.abs(h - origin.h)) h = w / ratio;
    else w = h * ratio;
  }

  // Keep the anchored edge fixed: the centre moves by half the size change,
  // expressed back in page space.
  const shiftLocal = {
    x: ((east ? 1 : 0) - (west ? 1 : 0)) * ((w - origin.w) / 2),
    y: ((south ? 1 : 0) - (north ? 1 : 0)) * ((h - origin.h) / 2),
  };
  const shift = rotatePoint(shiftLocal.x, shiftLocal.y, rotation);

  const centreX = origin.x + origin.w / 2 + shift.x;
  const centreY = origin.y + origin.h / 2 + shift.y;

  return {
    x: round(centreX - w / 2),
    y: round(centreY - h / 2),
    w: round(w),
    h: round(h),
  };
}

export function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: { axis: 'x' | 'y'; at: number }[];
}

/**
 * Nudges a moving box onto nearby alignment lines: page edges, page centre and
 * the edges/centres of the other elements on the same page.
 */
export function snapBox(options: {
  box: Box;
  pageWidth: number;
  pageHeight: number;
  others: AnyElement[];
  /** Snap distance in page units (callers pass `6 / zoom`). */
  threshold: number;
}): SnapResult {
  const { box, threshold } = options;

  const xTargets = [0, options.pageWidth / 2, options.pageWidth];
  const yTargets = [0, options.pageHeight / 2, options.pageHeight];
  for (const other of options.others) {
    xTargets.push(other.x, other.x + other.w / 2, other.x + other.w);
    yTargets.push(other.y, other.y + other.h / 2, other.y + other.h);
  }

  const xEdges = [box.x, box.x + box.w / 2, box.x + box.w];
  const yEdges = [box.y, box.y + box.h / 2, box.y + box.h];

  let bestX: { delta: number; at: number } | null = null;
  let bestY: { delta: number; at: number } | null = null;

  for (const edge of xEdges) {
    for (const target of xTargets) {
      const delta = target - edge;
      if (Math.abs(delta) <= threshold && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) {
        bestX = { delta, at: target };
      }
    }
  }
  for (const edge of yEdges) {
    for (const target of yTargets) {
      const delta = target - edge;
      if (Math.abs(delta) <= threshold && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) {
        bestY = { delta, at: target };
      }
    }
  }

  const guides: SnapResult['guides'] = [];
  if (bestX) guides.push({ axis: 'x', at: bestX.at });
  if (bestY) guides.push({ axis: 'y', at: bestY.at });

  return { dx: bestX?.delta ?? 0, dy: bestY?.delta ?? 0, guides };
}

export function boxesIntersect(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** Snaps a rotation angle to helpful increments. */
export function snapAngle(angle: number, coarse: boolean): number {
  const normalized = ((angle % 360) + 360) % 360;
  if (coarse) return Math.round(normalized / 15) * 15;
  for (const anchor of [0, 90, 180, 270, 360]) {
    if (Math.abs(normalized - anchor) <= 3) return anchor % 360;
  }
  return Math.round(normalized);
}
