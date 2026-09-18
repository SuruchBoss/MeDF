/**
 * Generates the application icon (256×256 PNG plus a PNG-in-ICO for Windows)
 * from the same geometry as the in-app logo, so the build needs no binary
 * asset checked into the repository and no image tooling installed.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const SIZE = 256;
const RADIUS = 56;
const STROKE = 18;

// The logo path, scaled from the 32-unit viewBox used by the React component.
const scale = SIZE / 32;
const M_POINTS = [
  [9, 22.5],
  [9, 10],
  [14.6, 16],
  [19.4, 10],
  [19.4, 22.5],
].map(([x, y]) => [x * scale, y * scale]);
const DOT = { x: 23.5 * scale, y: 22.5 * scale, r: 2.2 * scale };

const GRADIENT_FROM = [0x63, 0x66, 0xf1];
const GRADIENT_TO = [0x8b, 0x5c, 0xf6];

function smoothstep(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Signed distance from a point to a rounded rectangle covering the canvas. */
function roundedRectDistance(x, y) {
  const halfWidth = SIZE / 2 - RADIUS;
  const halfHeight = SIZE / 2 - RADIUS;
  const dx = Math.abs(x - SIZE / 2) - halfWidth;
  const dy = Math.abs(y - SIZE / 2) - halfHeight;
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - RADIUS;
}

function distanceToSegment(px, py, [ax, ay], [bx, by]) {
  const abx = bx - ax;
  const aby = by - ay;
  const lengthSquared = abx * abx + aby * aby;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * abx + (py - ay) * aby) / lengthSquared));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

function glyphCoverage(x, y) {
  let nearest = Infinity;
  for (let index = 1; index < M_POINTS.length; index += 1) {
    nearest = Math.min(nearest, distanceToSegment(x, y, M_POINTS[index - 1], M_POINTS[index]));
  }
  const stroke = 1 - smoothstep(STROKE / 2 - 1, STROKE / 2 + 1, nearest);
  const dot = 1 - smoothstep(DOT.r - 1, DOT.r + 1, Math.hypot(x - DOT.x, y - DOT.y));
  return Math.max(stroke, dot);
}

function renderPixels() {
  const pixels = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const offset = (y * SIZE + x) * 4;
      const inside = 1 - smoothstep(-1, 1, roundedRectDistance(x + 0.5, y + 0.5));
      const mix = (x + y) / (SIZE * 2);
      const background = GRADIENT_FROM.map((from, channel) =>
        Math.round(from + (GRADIENT_TO[channel] - from) * mix),
      );
      const ink = glyphCoverage(x + 0.5, y + 0.5);

      pixels[offset] = Math.round(background[0] + (255 - background[0]) * ink);
      pixels[offset + 1] = Math.round(background[1] + (255 - background[1]) * ink);
      pixels[offset + 2] = Math.round(background[2] + (255 - background[2]) * ink);
      pixels[offset + 3] = Math.round(inside * 255);
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

console.log(`[make-icon] build/icon.png (${png.length} bytes) และ build/icon.ico`);
