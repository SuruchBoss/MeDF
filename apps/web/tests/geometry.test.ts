import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AnyElement } from '../src/lib/editor-types.ts';
import {
  type Box,
  HANDLES,
  HANDLE_ORIGIN,
  MIN_SIZE,
  boxesIntersect,
  resizeBox,
  round,
  snapAngle,
  snapBox,
} from '../src/components/editor/geometry.ts';

const ORIGIN: Box = { x: 100, y: 100, w: 200, h: 100 };

function rect(id: string, box: Box): AnyElement {
  return {
    id,
    type: 'rect',
    page: 0,
    ...box,
    rotation: 0,
    opacity: 1,
    locked: false,
    fill: '#ffffff',
    stroke: null,
    strokeWidth: 1,
    radius: 0,
  };
}

/** The corner a handle drags away from must not move. */
function anchorOf(box: Box, handle: string): { x: number; y: number } {
  const { fx, fy } = HANDLE_ORIGIN[handle as keyof typeof HANDLE_ORIGIN];
  return { x: box.x + (1 - fx) * box.w, y: box.y + (1 - fy) * box.h };
}

describe('resizeBox (unrotated)', () => {
  it('grows east without moving the west edge', () => {
    const next = resizeBox({ origin: ORIGIN, rotation: 0, handle: 'e', dx: 50, dy: 0, keepRatio: false });
    assert.deepEqual(next, { x: 100, y: 100, w: 250, h: 100 });
  });

  it('grows west by moving the x origin, keeping the east edge put', () => {
    const next = resizeBox({ origin: ORIGIN, rotation: 0, handle: 'w', dx: -50, dy: 0, keepRatio: false });
    assert.deepEqual(next, { x: 50, y: 100, w: 250, h: 100 });
    assert.equal(next.x + next.w, ORIGIN.x + ORIGIN.w);
  });

  it('ignores the cross-axis for an edge handle', () => {
    const next = resizeBox({ origin: ORIGIN, rotation: 0, handle: 'e', dx: 50, dy: 80, keepRatio: false });
    assert.equal(next.h, ORIGIN.h);
    assert.equal(next.y, ORIGIN.y);
  });

  it('resizes both axes from a corner', () => {
    const next = resizeBox({ origin: ORIGIN, rotation: 0, handle: 'se', dx: 20, dy: 30, keepRatio: false });
    assert.deepEqual(next, { x: 100, y: 100, w: 220, h: 130 });
  });

  it('never shrinks below MIN_SIZE', () => {
    const next = resizeBox({ origin: ORIGIN, rotation: 0, handle: 'se', dx: -9999, dy: -9999, keepRatio: false });
    assert.equal(next.w, MIN_SIZE);
    assert.equal(next.h, MIN_SIZE);
  });

  it('keeps the anchored corner fixed for every handle', () => {
    for (const handle of HANDLES) {
      const before = anchorOf(ORIGIN, handle);
      const next = resizeBox({ origin: ORIGIN, rotation: 0, handle, dx: 37, dy: -21, keepRatio: false });
      const after = anchorOf(next, handle);
      assert.ok(
        Math.abs(before.x - after.x) < 0.11 && Math.abs(before.y - after.y) < 0.11,
        `handle ${handle}: anchor moved from ${JSON.stringify(before)} to ${JSON.stringify(after)}`,
      );
    }
  });
});

describe('resizeBox (keepRatio)', () => {
  it('holds the original aspect ratio from a corner', () => {
    const next = resizeBox({ origin: ORIGIN, rotation: 0, handle: 'se', dx: 100, dy: 5, keepRatio: true });
    assert.ok(Math.abs(next.w / next.h - ORIGIN.w / ORIGIN.h) < 0.02, `ratio drifted: ${next.w}x${next.h}`);
  });

  it('does not constrain an edge handle, which has only one axis to give', () => {
    const free = resizeBox({ origin: ORIGIN, rotation: 0, handle: 'e', dx: 100, dy: 0, keepRatio: false });
    const held = resizeBox({ origin: ORIGIN, rotation: 0, handle: 'e', dx: 100, dy: 0, keepRatio: true });
    assert.deepEqual(held, free);
  });
});

describe('resizeBox (rotated)', () => {
  it('follows the pointer along the element own axis, not the screen axis', () => {
    // At 90° the element's local +x points down the screen, so a downward drag
    // on the east handle is what grows the width.
    const next = resizeBox({ origin: ORIGIN, rotation: 90, handle: 'e', dx: 0, dy: 50, keepRatio: false });
    assert.ok(Math.abs(next.w - 250) < 0.11, `expected w≈250, got ${next.w}`);
    assert.ok(Math.abs(next.h - 100) < 0.11, `expected h≈100, got ${next.h}`);
  });

  it('a drag across the element own axis changes nothing on an edge handle', () => {
    const next = resizeBox({ origin: ORIGIN, rotation: 90, handle: 'e', dx: 50, dy: 0, keepRatio: false });
    assert.ok(Math.abs(next.w - ORIGIN.w) < 0.11, `expected w≈200, got ${next.w}`);
  });

  it('keeps the visual centre where the maths says it should be', () => {
    // Growing east by 50 in local space moves the centre half that far along
    // the element's own +x, which at 180° points left on screen.
    const next = resizeBox({ origin: ORIGIN, rotation: 180, handle: 'e', dx: -50, dy: 0, keepRatio: false });
    assert.ok(Math.abs(next.w - 250) < 0.11, `expected w≈250, got ${next.w}`);
    const centreX = next.x + next.w / 2;
    assert.ok(Math.abs(centreX - (ORIGIN.x + ORIGIN.w / 2 - 25)) < 0.11, `centre at ${centreX}`);
  });
});

describe('snapBox', () => {
  const page = { pageWidth: 600, pageHeight: 800, threshold: 6 };

  it('returns no nudge when nothing is in range', () => {
    // Deliberately off every page edge, page centre line and element edge.
    const result = snapBox({ ...page, box: { x: 237, y: 411, w: 50, h: 50 }, others: [] });
    assert.deepEqual(result, { dx: 0, dy: 0, guides: [] });
  });

  it('pulls a near-edge box onto the page edge', () => {
    const result = snapBox({ ...page, box: { x: 3, y: 500, w: 50, h: 50 }, others: [] });
    assert.equal(result.dx, -3);
    assert.deepEqual(result.guides, [{ axis: 'x', at: 0 }]);
  });

  it('centres a box on the page centre line', () => {
    const result = snapBox({ ...page, box: { x: 273, y: 500, w: 50, h: 50 }, others: [] });
    // Box centre is 298; the page centre is 300.
    assert.equal(result.dx, 2);
    assert.deepEqual(result.guides, [{ axis: 'x', at: 300 }]);
  });

  it('aligns to another element edge', () => {
    const result = snapBox({
      ...page,
      box: { x: 402, y: 500, w: 50, h: 50 },
      others: [rect('a', { x: 400, y: 100, w: 20, h: 20 })],
    });
    assert.equal(result.dx, -2);
    assert.deepEqual(result.guides, [{ axis: 'x', at: 400 }]);
  });

  it('prefers the closest of several candidates', () => {
    const result = snapBox({
      ...page,
      box: { x: 404, y: 500, w: 50, h: 50 },
      others: [rect('a', { x: 400, y: 100, w: 20, h: 20 }), rect('b', { x: 405, y: 100, w: 20, h: 20 })],
    });
    assert.equal(result.dx, 1);
  });

  it('snaps both axes at once', () => {
    const result = snapBox({ ...page, box: { x: 2, y: 797, w: 50, h: 50 }, others: [] });
    assert.equal(result.dx, -2);
    assert.equal(result.dy, 3);
    assert.equal(result.guides.length, 2);
  });

  it('respects the threshold exactly at its boundary', () => {
    assert.equal(snapBox({ ...page, box: { x: 6, y: 400, w: 10, h: 10 }, others: [] }).dx, -6);
    assert.equal(snapBox({ ...page, box: { x: 6.5, y: 400, w: 10, h: 10 }, others: [] }).dx, 0);
  });
});

describe('boxesIntersect', () => {
  const a: Box = { x: 0, y: 0, w: 10, h: 10 };

  it('is true for overlapping boxes', () => {
    assert.equal(boxesIntersect(a, { x: 5, y: 5, w: 10, h: 10 }), true);
  });

  it('is true when one box contains the other', () => {
    assert.equal(boxesIntersect(a, { x: 2, y: 2, w: 2, h: 2 }), true);
    assert.equal(boxesIntersect({ x: 2, y: 2, w: 2, h: 2 }, a), true);
  });

  it('is false for boxes that merely touch', () => {
    assert.equal(boxesIntersect(a, { x: 10, y: 0, w: 10, h: 10 }), false);
  });

  it('is false when they miss on one axis only', () => {
    assert.equal(boxesIntersect(a, { x: 5, y: 50, w: 10, h: 10 }), false);
  });

  it('is symmetric', () => {
    const b: Box = { x: -5, y: 5, w: 8, h: 8 };
    assert.equal(boxesIntersect(a, b), boxesIntersect(b, a));
  });
});

describe('snapAngle', () => {
  it('snaps to 15° steps when coarse', () => {
    assert.equal(snapAngle(38, true), 45);
    assert.equal(snapAngle(7, true), 0);
    // -7° normalises to 353°, which rounds up to 360 — it must come back as 0.
    assert.equal(snapAngle(-7, true), 0);
  });

  it('pulls near-quarter-turn angles onto the quarter turn', () => {
    assert.equal(snapAngle(88, false), 90);
    assert.equal(snapAngle(2, false), 0);
    assert.equal(snapAngle(358, false), 0);
  });

  it('leaves a free angle alone, rounded to a whole degree', () => {
    assert.equal(snapAngle(37.4, false), 37);
    assert.equal(snapAngle(37.6, false), 38);
  });

  it('always returns 0-359, never 360', () => {
    for (const angle of [-720, -370, -1, 0, 359.6, 360, 361, 1080]) {
      const snapped = snapAngle(angle, false);
      assert.ok(snapped >= 0 && snapped < 360, `snapAngle(${angle}) = ${snapped}`);
    }
    assert.equal(snapAngle(359.9, true), 0);
  });
});

describe('round', () => {
  it('keeps one decimal place so the overlay JSON stays small', () => {
    assert.equal(round(1.24), 1.2);
    assert.equal(round(1.25), 1.3);
    assert.equal(round(-1.26), -1.3);
    assert.equal(round(10), 10);
  });
});
