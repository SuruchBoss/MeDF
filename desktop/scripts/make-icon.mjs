/**
 * Generates the application icon (256×256 PNG plus a PNG-in-ICO for Windows).
 *
 * It re-draws the web logo from the same 32-unit geometry, so the installed app
 * and the site share one identity, and the build needs no binary asset in the
 * repository and no image tooling installed.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const SIZE = 256;
/** Everything below is authored in the logo's 32-unit grid and scaled up. */
const U = SIZE / 32;

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
      const x = (px + 0.5) / U;
      const y = (py + 0.5) / U;

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
      pixels[offset + 3] = Math.round(tileAlpha * 255);
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
function encodeIco(png) {
  const directory = Buffer.alloc(22);
  directory.writeUInt16LE(0, 0); // reserved
  directory.writeUInt16LE(1, 2); // type: icon
  directory.writeUInt16LE(1, 4); // one image
  directory[6] = 0; // width 256 is encoded as 0
  directory[7] = 0; // height 256 is encoded as 0
  directory[8] = 0; // palette size
  directory[9] = 0; // reserved
  directory.writeUInt16LE(1, 10); // colour planes
  directory.writeUInt16LE(32, 12); // bits per pixel
  directory.writeUInt32LE(png.length, 14);
  directory.writeUInt32LE(22, 18); // image offset
  return Buffer.concat([directory, png]);
}

const outDir = path.join(import.meta.dirname, '..', 'build');
await mkdir(outDir, { recursive: true });

const png = encodePng(renderPixels());
await writeFile(path.join(outDir, 'icon.png'), png);
await writeFile(path.join(outDir, 'icon.ico'), encodeIco(png));

/**
 * The web app's home-screen icon is the same mark, so it is written from here
 * rather than drawn a second time. Unlike the two above it is *tracked*: the
 * web build must not depend on the desktop workspace having been built.
 */
const webIcon = path.join(
  import.meta.dirname, '..', '..', 'apps', 'web', 'src', 'app', 'apple-icon.png',
);
await writeFile(webIcon, png);

console.log(
  `[make-icon] build/icon.png (${png.length} bytes), build/icon.ico ` +
    'และ apps/web/src/app/apple-icon.png',
);
