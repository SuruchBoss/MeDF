import 'server-only';
import {
  BlendMode,
  PDFDocument,
  type PDFImage,
  type PDFPage,
  concatTransformationMatrix,
  degrees,
  popGraphicsState,
  pushGraphicsState,
  rgb,
} from 'pdf-lib';
import type { AnyElement, OverlayDoc, PageState } from '../editor-types';
import { FontBook, safeWidth, wrapText } from './fonts';
import {
  type Matrix,
  displaySize,
  elementMatrix,
  multiply,
  normalizeRotation,
  pageMatrix,
} from './matrix';

/**
 * Renders an overlay back onto its original PDF.
 *
 * The original pages are *copied*, not rasterised, so the exported file keeps
 * the source text, vectors and fonts; the member's elements are painted on top
 * in the page's own coordinate space.
 *
 * Coordinate spaces, from the outside in:
 *   1. **Base display space** — what the member sees before any page rotation
 *      they applied: origin top-left, y down, size `page.width`×`page.height`.
 *      All element geometry is stored here.
 *   2. **Page space** — the PDF page's unrotated user space. `pageMatrix()`
 *      maps (1) into (2) using the page's own `/Rotate`.
 *   3. **Element space** — origin at the element's bottom-left corner, y up,
 *      rotated about the element's centre. `elementMatrix()` maps (3) into (1).
 */

export interface AssetBytes {
  bytes: Uint8Array;
  mimeType: string;
}

export interface RenderOptions {
  /** Original uploaded PDF. */
  source: Uint8Array;
  overlay: OverlayDoc;
  /** Resolves image elements to their stored bytes. */
  loadAsset: (assetId: string) => Promise<AssetBytes | null>;
  /** Free-plan exports carry a small footer credit. */
  watermark?: boolean;
  title?: string;
  author?: string;
}

export interface RenderResult {
  bytes: Uint8Array;
  pageCount: number;
  /** Image elements whose asset could not be loaded, by element id. */
  skipped: string[];
}

function parseColor(hex: string) {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;
  const int = Number.parseInt(full, 16);
  if (!Number.isFinite(int)) return rgb(0, 0, 0);
  return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255);
}

function roundedRectPath(w: number, h: number, radius: number): string {
  const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
  if (r === 0) return `M 0 0 L ${w} 0 L ${w} ${h} L 0 ${h} Z`;
  return [
    `M ${r} 0`,
    `L ${w - r} 0`,
    `Q ${w} 0 ${w} ${r}`,
    `L ${w} ${h - r}`,
    `Q ${w} ${h} ${w - r} ${h}`,
    `L ${r} ${h}`,
    `Q 0 ${h} 0 ${h - r}`,
    `L 0 ${r}`,
    `Q 0 0 ${r} 0`,
    'Z',
  ].join(' ');
}

function checkMarkPath(w: number, h: number): string {
  return `M ${w * 0.16} ${h * 0.55} L ${w * 0.4} ${h * 0.8} L ${w * 0.86} ${h * 0.2}`;
}

function crossMarkPath(w: number, h: number): string {
  return `M ${w * 0.18} ${h * 0.18} L ${w * 0.82} ${h * 0.82} M ${w * 0.82} ${h * 0.18} L ${w * 0.18} ${h * 0.82}`;
}

/** Converts a point given as a fraction of the element box into element space. */
function fractionToLocal(fx: number, fy: number, w: number, h: number): { x: number; y: number } {
  return { x: fx * w, y: h - fy * h };
}

function withTransform(page: PDFPage, matrix: Matrix, draw: () => void): void {
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...matrix));
  draw();
  page.pushOperators(popGraphicsState());
}

export async function renderOverlayToPdf(options: RenderOptions): Promise<RenderResult> {
  const { source, overlay, loadAsset } = options;

  const sourceDoc = await PDFDocument.load(source, {
    ignoreEncryption: true,
    updateMetadata: false,
  });
  const out = await PDFDocument.create();
  const fonts = new FontBook(out);
  const skipped: string[] = [];
  const imageCache = new Map<string, PDFImage | null>();

  const sourcePageCount = sourceDoc.getPageCount();
  const pages: PageState[] = overlay.pages.filter(
    (page) => !page.hidden && page.source >= 0 && page.source < sourcePageCount,
  );
  if (pages.length === 0) {
    throw new Error('ไม่มีหน้าที่จะ export (ทุกหน้าถูกซ่อนไว้)');
  }

  const copied = await out.copyPages(
    sourceDoc,
    pages.map((page) => page.source),
  );

  // Map overlay page index -> position in the exported document.
  const overlayIndexToOutput = new Map<number, number>();
  overlay.pages.forEach((page, index) => {
    const position = pages.indexOf(page);
    if (position !== -1) overlayIndexToOutput.set(index, position);
  });

  for (const page of copied) out.addPage(page);

  for (const [outputIndex, pageState] of pages.entries()) {
    const outPage = out.getPage(outputIndex);
    const sourcePage = sourceDoc.getPage(pageState.source);

    const intrinsic = normalizeRotation(sourcePage.getRotation().angle);
    const box = (() => {
      try {
        return sourcePage.getCropBox();
      } catch {
        return sourcePage.getMediaBox();
      }
    })();

    // The viewer applies the total rotation to page content *and* to anything
    // we paint, so element geometry only has to account for the intrinsic part.
    outPage.setRotation(degrees(normalizeRotation(intrinsic + pageState.rotation)));

    const base = displaySize(box.width, box.height, intrinsic);
    const matrix = pageMatrix({
      rotation: intrinsic,
      boxWidth: box.width,
      boxHeight: box.height,
      boxX: box.x,
      boxY: box.y,
    });

    const overlayIndex = overlay.pages.indexOf(pageState);
    const elements = overlay.elements.filter((element) => element.page === overlayIndex);

    for (const element of elements) {
      await drawElement({
        page: outPage,
        pageMatrix: matrix,
        element,
        fonts,
        out,
        loadAsset,
        imageCache,
        skipped,
      });
    }

    if (options.watermark) {
      await drawWatermark({ page: outPage, pageMatrix: matrix, fonts, base });
    }
  }

  out.setProducer('MeDF');
  out.setCreator('MeDF — โปรแกรมแก้ไข PDF');
  if (options.title) out.setTitle(options.title);
  if (options.author) out.setAuthor(options.author);
  out.setModificationDate(new Date());

  const bytes = await out.save({ addDefaultPage: false });
  return { bytes, pageCount: pages.length, skipped };
}

interface DrawContext {
  page: PDFPage;
  pageMatrix: Matrix;
  element: AnyElement;
  fonts: FontBook;
  out: PDFDocument;
  loadAsset: (assetId: string) => Promise<AssetBytes | null>;
  imageCache: Map<string, PDFImage | null>;
  skipped: string[];
}

async function drawElement(context: DrawContext): Promise<void> {
  const { element } = context;
  const w = element.w;
  const h = element.h;
  const matrix = multiply(
    context.pageMatrix,
    elementMatrix({ x: element.x, y: element.y, w, h, rotation: element.rotation }),
  );
  const opacity = Math.max(0, Math.min(1, element.opacity));
  const page = context.page;

  switch (element.type) {
    case 'text': {
      const font = await context.fonts.resolve(
        { family: element.fontFamily, bold: element.bold, italic: element.italic },
        element.text,
      );
      const padding = element.padding;
      const innerWidth = Math.max(1, w - padding * 2);
      const lineHeight = element.fontSize * element.lineHeight;
      const ascent = font.heightAtSize(element.fontSize, { descender: false });
      const fullHeight = font.heightAtSize(element.fontSize, { descender: true });
      const halfLeading = (lineHeight - fullHeight) / 2;
      const lines = wrapText(element.text, font, element.fontSize, innerWidth);
      const color = parseColor(element.color);

      withTransform(page, matrix, () => {
        if (element.background) {
          page.drawRectangle({
            x: 0,
            y: 0,
            width: w,
            height: h,
            color: parseColor(element.background),
            opacity,
          });
        }

        lines.forEach((line, index) => {
          if (line === '') return;
          const width = safeWidth(font, line, element.fontSize);
          const x =
            element.align === 'center'
              ? padding + (innerWidth - width) / 2
              : element.align === 'right'
                ? padding + innerWidth - width
                : padding;
          const baselineFromTop = index * lineHeight + halfLeading + ascent;
          const y = h - padding - baselineFromTop;

          page.drawText(line, {
            x,
            y,
            size: element.fontSize,
            font,
            color,
            opacity,
          });

          if (element.underline) {
            const thickness = Math.max(0.6, element.fontSize * 0.06);
            page.drawLine({
              start: { x, y: y - element.fontSize * 0.14 },
              end: { x: x + width, y: y - element.fontSize * 0.14 },
              thickness,
              color,
              opacity,
            });
          }
        });
      });
      return;
    }

    case 'image': {
      const image = await resolveImage(context, element.assetId);
      if (!image) {
        context.skipped.push(element.id);
        return;
      }
      withTransform(page, matrix, () => {
        page.drawImage(image, { x: 0, y: 0, width: w, height: h, opacity });
      });
      return;
    }

    case 'rect': {
      withTransform(page, matrix, () => {
        page.drawSvgPath(roundedRectPath(w, h, element.radius), {
          x: 0,
          y: h,
          color: element.fill ? parseColor(element.fill) : undefined,
          borderColor: element.stroke ? parseColor(element.stroke) : undefined,
          borderWidth: element.stroke ? element.strokeWidth : 0,
          opacity,
          borderOpacity: opacity,
        });
      });
      return;
    }

    case 'ellipse': {
      withTransform(page, matrix, () => {
        page.drawEllipse({
          x: w / 2,
          y: h / 2,
          xScale: Math.max(0.1, w / 2),
          yScale: Math.max(0.1, h / 2),
          color: element.fill ? parseColor(element.fill) : undefined,
          borderColor: element.stroke ? parseColor(element.stroke) : undefined,
          borderWidth: element.stroke ? element.strokeWidth : 0,
          opacity,
          borderOpacity: opacity,
        });
      });
      return;
    }

    case 'line': {
      const start = fractionToLocal(element.from[0], element.from[1], w, h);
      const end = fractionToLocal(element.to[0], element.to[1], w, h);
      const color = parseColor(element.stroke);
      withTransform(page, matrix, () => {
        page.drawLine({ start, end, thickness: element.strokeWidth, color, opacity });
        const head = Math.max(4, element.strokeWidth * 3.2);
        if (element.arrowEnd) drawArrowHead(page, start, end, head, color, opacity, element.strokeWidth);
        if (element.arrowStart) drawArrowHead(page, end, start, head, color, opacity, element.strokeWidth);
      });
      return;
    }

    case 'draw': {
      const color = parseColor(element.stroke);
      withTransform(page, matrix, () => {
        for (const stroke of element.strokes) {
          if (stroke.length === 1) {
            const dot = fractionToLocal(stroke[0][0], stroke[0][1], w, h);
            page.drawCircle({
              x: dot.x,
              y: dot.y,
              size: element.strokeWidth / 2,
              color,
              opacity,
            });
            continue;
          }
          for (let index = 1; index < stroke.length; index += 1) {
            const from = fractionToLocal(stroke[index - 1][0], stroke[index - 1][1], w, h);
            const to = fractionToLocal(stroke[index][0], stroke[index][1], w, h);
            page.drawLine({
              start: from,
              end: to,
              thickness: element.strokeWidth,
              color,
              opacity,
              lineCap: 1,
            });
          }
        }
      });
      return;
    }

    case 'highlight': {
      withTransform(page, matrix, () => {
        page.drawRectangle({
          x: 0,
          y: 0,
          width: w,
          height: h,
          color: parseColor(element.color),
          opacity,
          blendMode: BlendMode.Multiply,
        });
      });
      return;
    }

    case 'check': {
      const color = parseColor(element.color);
      withTransform(page, matrix, () => {
        if (element.variant === 'dot') {
          page.drawCircle({
            x: w / 2,
            y: h / 2,
            size: Math.min(w, h) / 2.6,
            color,
            opacity,
          });
          return;
        }
        page.drawSvgPath(
          element.variant === 'cross' ? crossMarkPath(w, h) : checkMarkPath(w, h),
          {
            x: 0,
            y: h,
            borderColor: color,
            borderWidth: element.strokeWidth,
            borderOpacity: opacity,
          },
        );
      });
      return;
    }

    default: {
      // Exhaustiveness guard: a new element type must add a branch above.
      const exhaustive: never = element;
      throw new Error(`ยังไม่รองรับ element ชนิดนี้: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function drawArrowHead(
  page: PDFPage,
  from: { x: number; y: number },
  to: { x: number; y: number },
  size: number,
  color: ReturnType<typeof rgb>,
  opacity: number,
  thickness: number,
): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const spread = Math.PI / 7;
  for (const direction of [angle + Math.PI - spread, angle + Math.PI + spread]) {
    page.drawLine({
      start: to,
      end: { x: to.x + Math.cos(direction) * size, y: to.y + Math.sin(direction) * size },
      thickness,
      color,
      opacity,
      lineCap: 1,
    });
  }
}

async function resolveImage(context: DrawContext, assetId: string): Promise<PDFImage | null> {
  if (context.imageCache.has(assetId)) return context.imageCache.get(assetId) ?? null;

  const asset = await context.loadAsset(assetId);
  let image: PDFImage | null = null;
  if (asset) {
    try {
      image = asset.mimeType === 'image/png'
        ? await context.out.embedPng(asset.bytes)
        : await context.out.embedJpg(asset.bytes);
    } catch {
      image = null;
    }
  }
  context.imageCache.set(assetId, image);
  return image;
}

async function drawWatermark(options: {
  page: PDFPage;
  pageMatrix: Matrix;
  fonts: FontBook;
  base: { width: number; height: number };
}): Promise<void> {
  const { page, base } = options;
  const text = 'สร้างด้วย MeDF — อัปเกรดเป็น Pro เพื่อลบข้อความนี้';
  const size = 8;
  const font = await options.fonts.load({ family: 'sarabun', bold: false, italic: false });
  const width = safeWidth(font, text, size);
  const boxWidth = Math.min(base.width - 24, width + 8);
  const matrix = multiply(
    options.pageMatrix,
    elementMatrix({
      x: base.width - boxWidth - 12,
      y: base.height - 20,
      w: boxWidth,
      h: 14,
      rotation: 0,
    }),
  );

  withTransform(page, matrix, () => {
    page.drawText(text, {
      x: 0,
      y: 3,
      size,
      font,
      color: rgb(0.45, 0.45, 0.5),
      opacity: 0.75,
    });
  });
}
