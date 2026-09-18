import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  IDENTITY,
  type Matrix,
  applyMatrix,
  compose,
  displaySize,
  elementMatrix,
  flipY,
  multiply,
  normalizeRotation,
  pageMatrix,
  rotateClockwise,
  scale,
  translate,
} from '../src/lib/pdf/matrix.ts';

/** Matrices are built from trig, so compare to a tolerance, not exactly. */
function close(actual: number, expected: number, message?: string) {
  assert.ok(
    Math.abs(actual - expected) < 1e-9,
    message ?? `expected ${actual} to be about ${expected}`,
  );
}

function closePoint(actual: [number, number], expected: [number, number]) {
  close(actual[0], expected[0], `x: ${actual[0]} vs ${expected[0]}`);
  close(actual[1], expected[1], `y: ${actual[1]} vs ${expected[1]}`);
}

describe('multiply', () => {
  it('leaves a matrix unchanged when multiplied by the identity', () => {
    const m: Matrix = [2, 3, 4, 5, 6, 7];
    assert.deepEqual(multiply(m, IDENTITY), m);
    assert.deepEqual(multiply(IDENTITY, m), m);
  });

  it('applies the right-hand matrix first', () => {
    // Scale then translate: the translation must NOT be scaled.
    const m = multiply(translate(10, 20), scale(2, 2));
    closePoint(applyMatrix(m, 1, 1), [12, 22]);

    // Translate then scale: now it is.
    const n = multiply(scale(2, 2), translate(10, 20));
    closePoint(applyMatrix(n, 1, 1), [22, 42]);
  });

  it('is associative', () => {
    const a = translate(3, -4);
    const b = rotateClockwise(37);
    const c = scale(2, 0.5);
    const left = multiply(multiply(a, b), c);
    const right = multiply(a, multiply(b, c));
    left.forEach((value, index) => close(value, right[index]));
  });
});

describe('compose', () => {
  it('of nothing is the identity', () => {
    assert.deepEqual(compose(), IDENTITY);
  });

  it('applies its arguments left to right, outermost first', () => {
    const composed = compose(translate(10, 0), scale(2, 2));
    closePoint(applyMatrix(composed, 3, 0), [16, 0]);
  });
});

describe('rotateClockwise', () => {
  it('turns +x towards +y, which reads clockwise in a y-down space', () => {
    closePoint(applyMatrix(rotateClockwise(90), 1, 0), [0, 1]);
    closePoint(applyMatrix(rotateClockwise(90), 0, 1), [-1, 0]);
  });

  it('is the identity at 0 and 360 degrees', () => {
    closePoint(applyMatrix(rotateClockwise(0), 7, -3), [7, -3]);
    closePoint(applyMatrix(rotateClockwise(360), 7, -3), [7, -3]);
  });

  it('composes additively', () => {
    const twice = multiply(rotateClockwise(30), rotateClockwise(30));
    const once = rotateClockwise(60);
    twice.forEach((value, index) => close(value, once[index]));
  });
});

describe('flipY', () => {
  it('mirrors about the half-height and is its own inverse', () => {
    closePoint(applyMatrix(flipY(100), 5, 0), [5, 100]);
    closePoint(applyMatrix(flipY(100), 5, 100), [5, 0]);
    closePoint(applyMatrix(multiply(flipY(100), flipY(100)), 5, 42), [5, 42]);
  });
});

describe('pageMatrix', () => {
  const box = { boxWidth: 600, boxHeight: 800, boxX: 0, boxY: 0 };

  it('maps a y-down display corner onto PDF user space at 0 degrees', () => {
    const m = pageMatrix({ ...box, rotation: 0 });
    // Display top-left is the PDF top-left, i.e. (0, boxHeight).
    closePoint(applyMatrix(m, 0, 0), [0, 800]);
    // Display bottom-left is the PDF origin.
    closePoint(applyMatrix(m, 0, 800), [0, 0]);
    closePoint(applyMatrix(m, 600, 800), [600, 0]);
  });

  it('keeps every display corner inside the page box at each rotation', () => {
    for (const rotation of [0, 90, 180, 270] as const) {
      const { width, height } = displaySize(600, 800, rotation);
      const m = pageMatrix({ ...box, rotation });
      for (const [dx, dy] of [
        [0, 0],
        [width, 0],
        [0, height],
        [width, height],
      ]) {
        const [x, y] = applyMatrix(m, dx, dy);
        assert.ok(x >= -1e-9 && x <= 600 + 1e-9, `rotation ${rotation}: x=${x} off page`);
        assert.ok(y >= -1e-9 && y <= 800 + 1e-9, `rotation ${rotation}: y=${y} off page`);
      }
    }
  });

  it('preserves area, so nothing is squashed', () => {
    for (const rotation of [0, 90, 180, 270] as const) {
      const [a, b, c, d] = pageMatrix({ ...box, rotation });
      close(Math.abs(a * d - b * c), 1, `rotation ${rotation} is not area-preserving`);
    }
  });

  it('shifts by the crop box origin', () => {
    const shifted = pageMatrix({ ...box, rotation: 0, boxX: 20, boxY: 30 });
    closePoint(applyMatrix(shifted, 0, 800), [20, 30]);
  });
});

describe('elementMatrix', () => {
  const element = { x: 100, y: 50, w: 200, h: 80, rotation: 0 };

  it('puts the origin at the element bottom-left with y pointing up', () => {
    const m = elementMatrix(element);
    closePoint(applyMatrix(m, 0, 0), [100, 130]);
    closePoint(applyMatrix(m, 0, 80), [100, 50]);
    closePoint(applyMatrix(m, 200, 80), [300, 50]);
  });

  it('rotates about the element centre, leaving the centre put', () => {
    const centre: [number, number] = [element.x + element.w / 2, element.y + element.h / 2];
    for (const rotation of [0, 17, 90, 180, -45]) {
      const m = elementMatrix({ ...element, rotation });
      closePoint(applyMatrix(m, element.w / 2, element.h / 2), centre);
    }
  });

  it('turns the box clockwise as seen on screen', () => {
    // The element's own top-left is (0, h) in element space, i.e. display
    // (100, 50) — left of and above the centre (200, 90). A clockwise quarter
    // turn in this y-down space must send it to the *right* of the centre.
    const m = elementMatrix({ ...element, rotation: 90 });
    const topLeft = applyMatrix(m, 0, element.h);
    closePoint(topLeft, [240, -10]);
    assert.ok(topLeft[0] > 200, 'top-left should end up right of the centre');
    assert.ok(topLeft[1] < 90, 'top-left should stay above the centre');
  });

  it('keeps the four corners a rigid rectangle at any angle', () => {
    const m = elementMatrix({ ...element, rotation: 31 });
    const [bl, br, tr, tl] = [
      applyMatrix(m, 0, 0),
      applyMatrix(m, element.w, 0),
      applyMatrix(m, element.w, element.h),
      applyMatrix(m, 0, element.h),
    ];
    const span = (a: [number, number], b: [number, number]) =>
      Math.hypot(a[0] - b[0], a[1] - b[1]);
    close(span(bl, br), element.w);
    close(span(tl, tr), element.w);
    close(span(bl, tl), element.h);
    close(span(br, tr), element.h);
    // Both diagonals equal => still a rectangle, not a parallelogram.
    close(span(bl, tr), span(br, tl));
  });
});

describe('displaySize', () => {
  it('swaps the axes on a quarter turn only', () => {
    assert.deepEqual(displaySize(600, 800, 0), { width: 600, height: 800 });
    assert.deepEqual(displaySize(600, 800, 90), { width: 800, height: 600 });
    assert.deepEqual(displaySize(600, 800, 180), { width: 600, height: 800 });
    assert.deepEqual(displaySize(600, 800, 270), { width: 800, height: 600 });
  });

  it('normalises angles outside 0-359', () => {
    assert.deepEqual(displaySize(600, 800, -90), { width: 800, height: 600 });
    assert.deepEqual(displaySize(600, 800, 450), { width: 800, height: 600 });
  });
});

describe('normalizeRotation', () => {
  it('snaps to the nearest quarter turn', () => {
    assert.equal(normalizeRotation(0), 0);
    assert.equal(normalizeRotation(89), 90);
    assert.equal(normalizeRotation(91), 90);
    assert.equal(normalizeRotation(359), 0);
  });

  it('brings negative and over-full turns into 0-270', () => {
    assert.equal(normalizeRotation(-90), 270);
    assert.equal(normalizeRotation(-360), 0);
    assert.equal(normalizeRotation(450), 90);
    assert.equal(normalizeRotation(720), 0);
  });
});
