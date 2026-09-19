/**
 * Generates every raster icon the site ships, from one drawing.
 *
 *   apps/web/src/app/favicon.ico       anything that asks for /favicon.ico
 *   apps/web/src/app/apple-icon.png    iOS home screen
 *   apps/web/public/icon-192.png       web app manifest
 *   apps/web/public/icon-512.png       web app manifest
 *   apps/web/public/icon-maskable.png  Android adaptive icon
 *
 * It re-draws the logo from the same 32-unit geometry that `LogoMark` uses, so
 * the installed app and the site share one identity, and the build needs no
 * binary asset checked in and no image tooling installed.
 *
 * The outputs are *tracked* in git: `next build` must not depend on anyone
 * having run this first. Re-run it after changing the mark, or the site keeps
 * the old one.
 *
 *   node scripts/make-icons.mjs
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

/**
 * The pixel grid the drawing samples against. Both are set by `render()`
 * before each pass rather than threaded through every distance function —
 * mutable module state, but this is a fifty-line renderer with one caller.
 */
let SIZE = 256;
/** Everything below is authored in the logo's 32-unit grid and scaled up. */
let U = SIZE / 32;
/** Left/top offset in pixels, so a maskable icon can inset the mark. */
let PAD = 0;
/** True for a maskable icon: the gradient fills the square, corners and all. */
let OPAQUE = false;

const GRADIENT = [
  { at: 0.0, rgb: [0x4f, 0x46, 0xe5] },
  { at: 0.5, rgb: [0x7c, 0x3a, 0xed] },
  { at: 1.0, rgb: [0xc0, 0x26, 0xd3] },
];
const INK = [0x4f, 0x46, 0xe5];
const FOLD = [0xc4, 0xb5, 0xfd];
const WHITE = [0xff, 0xff, 0xff];

function smoothstep(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Signed distance to a rounded rectangle, in logo units. */
function sdRoundedRect(x, y, rx, ry, w, h, r) {
  const cx = rx + w / 2;
  const cy = ry + h / 2;
  const dx = Math.abs(x - cx) - (w / 2 - r);
  const dy = Math.abs(y - cy) - (h / 2 - r);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
}

function sdCircle(x, y, cx, cy, r) {
  return Math.hypot(x - cx, y - cy) - r;
}

/** Coverage of a filled shape, antialiased over roughly one device pixel. */
function fillAlpha(distance) {
  const feather = 1 / U;
  return 1 - smoothstep(-feather, feather, distance);
}

/** Coverage of a stroke of the given width centred on the shape's edge. */
function strokeAlpha(distance, width) {
  return fillAlpha(Math.abs(distance) - width / 2);
}

function gradientAt(t) {
  const clamped = Math.min(1, Math.max(0, t));
  for (let index = 1; index < GRADIENT.length; index += 1) {
    const from = GRADIENT[index - 1];
    const to = GRADIENT[index];
    if (clamped <= to.at) {
      const local = (clamped - from.at) / (to.at - from.at);
      return from.rgb.map((channel, i) => channel + (to.rgb[i] - channel) * local);
    }
  }
  return GRADIENT.at(-1).rgb;
}

function blend(base, layer, alpha) {
  if (alpha <= 0) return base;
  return base.map((channel, index) => channel + (layer[index] - channel) * alpha);
}

/**
 * Draws the same mark as `LogoMark` in apps/web/src/components/icons.tsx:
 * a gradient tile, a sheet with a folded corner, two text lines, and an
 * element laid over the page with one selection handle.
 */
function renderPixels() {
  const pixels = Buffer.alloc(SIZE * SIZE * 4);

  for (let py = 0; py < SIZE; py += 1) {
    for (let px = 0; px < SIZE; px += 1) {
      // Sample at the pixel centre, in logo units.
      const x = (px + 0.5 - PAD) / U;
      const y = (py + 0.5 - PAD) / U;

      const tile = sdRoundedRect(x, y, 0, 0, 32, 32, 8.5);
      const tileAlpha = fillAlpha(tile);

      let colour = gradientAt((x - 2 + y) / 60);

      // Sheet: a rounded rectangle with the top-right corner cut along the
      // fold line y = x - 11.
      const sheetBody = sdRoundedRect(x, y, 6.4, 5.6, 15.8, 17.6, 2.8);
      const belowFold = y - (x - 11);
      const sheet = Math.max(sheetBody, -belowFold);
      colour = blend(colour, WHITE, fillAlpha(sheet));

      // The folded corner itself.
      const foldTriangle = Math.max(16.6 - x, Math.max(y - 11.2, -(y - (x - 11))));
      colour = blend(colour, FOLD, fillAlpha(foldTriangle));

      // Text lines on the page.
      const line1 = sdRoundedRect(x, y, 9.3, 12.4, 8.6, 1.9, 0.95);
      const line2 = sdRoundedRect(x, y, 9.3, 15.8, 5.6, 1.9, 0.95);
      colour = blend(colour, INK, fillAlpha(Math.min(line1, line2)) * 0.32);

      // The element placed on the page: white fill, indigo border.
      const chip = sdRoundedRect(x, y, 14.2, 16.8, 11.2, 8.4, 2.4);
      colour = blend(colour, WHITE, fillAlpha(chip));
      colour = blend(colour, INK, strokeAlpha(chip, 2.2));

      // Its selection handle.
      const handle = sdCircle(x, y, 25.4, 25.2, 2.4);
      colour = blend(colour, WHITE, fillAlpha(handle));
      colour = blend(colour, INK, strokeAlpha(handle, 2));

      const offset = (py * SIZE + px) * 4;
      pixels[offset] = Math.round(colour[0]);
      pixels[offset + 1] = Math.round(colour[1]);
      pixels[offset + 2] = Math.round(colour[2]);
      // A maskable icon is cropped to whatever shape the launcher wants, so
      // it must bleed to the edge; the inset keeps the mark inside the crop.
      pixels[offset + 3] = Math.round((OPAQUE ? 1 : tileAlpha) * 255);
    }
  }

  return pixels;
}

// --- Minimal PNG encoder (RGBA, no interlacing) ------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0);
  header.writeUInt32BE(SIZE, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  // One filter byte (0 = none) in front of every scanline.
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  for (let y = 0; y < SIZE; y += 1) {
    raw[y * (SIZE * 4 + 1)] = 0;
    pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Wraps the PNG in an ICO container (supported by Windows Vista and later). */
function encodeIco(png, size) {
  const directory = Buffer.alloc(22);
  directory.writeUInt16LE(0, 0); // reserved
  directory.writeUInt16LE(1, 2); // type: icon
  directory.writeUInt16LE(1, 4); // one image
  // The directory must agree with the PNG inside it, and 256 is the one size
  // that does not fit in a byte — it is written as 0.
  directory[6] = size % 256;
  directory[7] = size % 256;
  directory[8] = 0; // palette size
  directory[9] = 0; // reserved
  directory.writeUInt16LE(1, 10); // colour planes
  directory.writeUInt16LE(32, 12); // bits per pixel
  directory.writeUInt32LE(png.length, 14);
  directory.writeUInt32LE(22, 18); // image offset
  return Buffer.concat([directory, png]);
}

/**
 * Renders one square icon.
 *
 * `inset` is the fraction of the square left clear on each side. Android crops
 * a maskable icon to its own shape — a circle on many launchers — and
 * guarantees only the middle 80%. A square mark inscribed in that circle can
 * only be about 68% of the side, which is what the inset buys; the gradient
 * runs to the edge behind it.
 */
function render(size, { inset = 0, opaque = false } = {}) {
  SIZE = size;
  PAD = Math.round(size * inset);
  U = (size - PAD * 2) / 32;
  OPAQUE = opaque;
  return encodePng(renderPixels());
}

const webApp = path.join(import.meta.dirname, '..', 'apps', 'web', 'src', 'app');
const webPublic = path.join(import.meta.dirname, '..', 'apps', 'web', 'public');

const written = [
  // 256 is what iOS wants for a home-screen icon.
  [path.join(webApp, 'apple-icon.png'), render(256)],
  // Modern browsers follow `<link rel="icon">` to the SVG, but crawlers and
  // older clients still ask for /favicon.ico and got a 404.
  [path.join(webApp, 'favicon.ico'), encodeIco(render(64), 64)],
  [path.join(webPublic, 'icon-192.png'), render(192)],
  [path.join(webPublic, 'icon-512.png'), render(512)],
  [path.join(webPublic, 'icon-maskable.png'), render(512, { inset: 0.16, opaque: true })],
];
for (const [target, bytes] of written) await writeFile(target, bytes);

console.log(`[make-icons] เขียนไอคอน ${written.length} ไฟล์`);
