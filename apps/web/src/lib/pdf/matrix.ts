/**
 * 2-D affine transforms, expressed the way PDF wants them: the six numbers of
 * a `cm` operator, `[a b c d e f]`, meaning
 *
 *   x' = a·x + c·y + e
 *   y' = b·x + d·y + f
 */

export type Matrix = readonly [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** `multiply(m, n)` applies `n` first, then `m` (the usual matrix order). */
export function multiply(m: Matrix, n: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = m;
  const [a2, b2, c2, d2, e2, f2] = n;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

export function compose(...matrices: Matrix[]): Matrix {
  return matrices.reduce((acc, matrix) => multiply(acc, matrix), IDENTITY);
}

export function translate(tx: number, ty: number): Matrix {
  return [1, 0, 0, 1, tx, ty];
}

export function scale(sx: number, sy: number): Matrix {
  return [sx, 0, 0, sy, 0, 0];
}

/**
 * Rotation that reads as *clockwise* on screen when used inside a y-down
 * coordinate space — matching the CSS `rotate()` the editor applies.
 */
export function rotateClockwise(degrees: number): Matrix {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [cos, sin, -sin, cos, 0, 0];
}

/** Flips a box of height `h` between y-down and y-up local space. */
export function flipY(h: number): Matrix {
  return [1, 0, 0, -1, 0, h];
}

export function applyMatrix(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/**
 * Maps the page as the member sees it (origin top-left, y down, size
 * `displayWidth`×`displayHeight`) onto the page's own unrotated user space.
 *
 * `rotation` is the total `/Rotate` of the output page, and `boxX`/`boxY` carry
 * the CropBox origin for PDFs whose page box does not start at (0, 0).
 */
export function pageMatrix(options: {
  rotation: 0 | 90 | 180 | 270;
  /** Unrotated page box size, in points. */
  boxWidth: number;
  boxHeight: number;
  boxX: number;
  boxY: number;
}): Matrix {
  const { rotation, boxWidth, boxHeight, boxX, boxY } = options;
  const offset = translate(boxX, boxY);

  switch (rotation) {
    case 90:
      // (dx, dy) -> (dy, dx)
      return multiply(offset, [0, 1, 1, 0, 0, 0]);
    case 180:
      // (dx, dy) -> (boxWidth - dx, dy)
      return multiply(offset, [-1, 0, 0, 1, boxWidth, 0]);
    case 270:
      // (dx, dy) -> (boxWidth - dy, boxHeight - dx)
      return multiply(offset, [0, -1, -1, 0, boxWidth, boxHeight]);
    case 0:
    default:
      // (dx, dy) -> (dx, boxHeight - dy)
      return multiply(offset, [1, 0, 0, -1, 0, boxHeight]);
  }
}

/**
 * Local space for one element: origin at the element's bottom-left corner with
 * y pointing up (so text and images can be drawn the PDF-native way), rotated
 * about the element's centre.
 */
export function elementMatrix(options: {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}): Matrix {
  const { x, y, w, h, rotation } = options;
  const centre = translate(x + w / 2, y + h / 2);
  const spin = rotateClockwise(rotation);
  const toCorner = translate(-w / 2, -h / 2);
  return compose(centre, spin, toCorner, flipY(h));
}

/** Display size of a page box once `/Rotate` is taken into account. */
export function displaySize(
  boxWidth: number,
  boxHeight: number,
  rotation: number,
): { width: number; height: number } {
  const normalized = ((rotation % 360) + 360) % 360;
  return normalized === 90 || normalized === 270
    ? { width: boxHeight, height: boxWidth }
    : { width: boxWidth, height: boxHeight };
}

export function normalizeRotation(angle: number): 0 | 90 | 180 | 270 {
  const normalized = ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
  return normalized as 0 | 90 | 180 | 270;
}
