import fontkit from '@pdf-lib/fontkit';
import { type PDFDocument, type PDFFont, StandardFonts } from 'pdf-lib';
import type { FontFamily } from '../editor-types';

/**
 * Font handling for the export pipeline.
 *
 * Sarabun ships with the app and is embedded (subset) whenever a text box uses
 * it, or whenever text contains characters the PDF standard fonts cannot
 * encode — which is every Thai character. The same TTFs are served to the
 * browser as web fonts, so what the member wraps on screen is what pdf-lib
 * wraps on export.
 *
 * This module is isomorphic: where the font *bytes* come from is the caller's
 * business (`fonts-node.ts` reads them from disk, `fonts-browser.ts` fetches
 * them), which is what lets the same export code run on the server and in the
 * browser-only demo build.
 */

export interface FontStyle {
  family: FontFamily;
  bold: boolean;
  italic: boolean;
}

/** Resolves a bundled font file name to its bytes. */
export type FontLoader = (fileName: string) => Promise<Uint8Array>;

export const SARABUN_FILES = {
  regular: 'Sarabun-Regular.ttf',
  bold: 'Sarabun-Bold.ttf',
  italic: 'Sarabun-Italic.ttf',
  boldItalic: 'Sarabun-BoldItalic.ttf',
} as const;

type SarabunVariant = keyof typeof SARABUN_FILES;

function sarabunVariant(style: FontStyle): SarabunVariant {
  if (style.bold && style.italic) return 'boldItalic';
  if (style.bold) return 'bold';
  if (style.italic) return 'italic';
  return 'regular';
}

function standardFont(style: FontStyle): StandardFonts {
  const { family, bold, italic } = style;
  if (family === 'times') {
    if (bold && italic) return StandardFonts.TimesRomanBoldItalic;
    if (bold) return StandardFonts.TimesRomanBold;
    if (italic) return StandardFonts.TimesRomanItalic;
    return StandardFonts.TimesRoman;
  }
  if (family === 'courier') {
    if (bold && italic) return StandardFonts.CourierBoldOblique;
    if (bold) return StandardFonts.CourierBold;
    if (italic) return StandardFonts.CourierOblique;
    return StandardFonts.Courier;
  }
  if (bold && italic) return StandardFonts.HelveticaBoldOblique;
  if (bold) return StandardFonts.HelveticaBold;
  if (italic) return StandardFonts.HelveticaOblique;
  return StandardFonts.Helvetica;
}

/** True when every character can be encoded by a WinAnsi standard font. */
export function isWinAnsiSafe(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code > 0xff) return false;
  }
  return true;
}

/**
 * Per-document font cache. pdf-lib embeds a font object per `PDFDocument`, so
 * one of these is created for each export.
 */
export class FontBook {
  private readonly cache = new Map<string, Promise<PDFFont>>();
  private fontkitRegistered = false;

  constructor(
    private readonly doc: PDFDocument,
    private readonly loadFontBytes: FontLoader,
  ) {}

  /**
   * Resolves the font to use for a run of text, transparently upgrading to
   * Sarabun when the requested standard font cannot represent the characters.
   */
  async resolve(style: FontStyle, text: string): Promise<PDFFont> {
    const needsUnicode = !isWinAnsiSafe(text);
    const family: FontFamily = needsUnicode ? 'sarabun' : style.family;
    return this.load({ ...style, family });
  }

  async load(style: FontStyle): Promise<PDFFont> {
    const key = `${style.family}:${style.bold ? 'b' : ''}${style.italic ? 'i' : ''}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const promise = (async () => {
      if (style.family === 'sarabun') {
        if (!this.fontkitRegistered) {
          this.doc.registerFontkit(fontkit);
          this.fontkitRegistered = true;
        }
        const bytes = await this.loadFontBytes(SARABUN_FILES[sarabunVariant(style)]);
        try {
          return await this.doc.embedFont(bytes, { subset: true });
        } catch {
          // Subsetting can fail on unusual glyph tables — embed the full face.
          return this.doc.embedFont(bytes, { subset: false });
        }
      }
      return this.doc.embedFont(standardFont(style));
    })();

    this.cache.set(key, promise);
    return promise;
  }
}

/** Measures text, tolerating glyphs the font cannot encode. */
export function safeWidth(font: PDFFont, text: string, size: number): number {
  if (!text) return 0;
  try {
    return font.widthOfTextAtSize(text, size);
  } catch {
    // Rough fallback so a single unsupported glyph cannot abort the export.
    return text.length * size * 0.5;
  }
}

/**
 * Wraps `text` to `maxWidth`, honouring explicit newlines.
 *
 * Words are broken on whitespace first. Thai (and other scripts without word
 * spaces) produces very long "words", so anything that still does not fit is
 * broken per character — the same thing the browser does with
 * `overflow-wrap: break-word`.
 */
export function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }
    if (maxWidth <= 0 || safeWidth(font, paragraph, size) <= maxWidth) {
      lines.push(paragraph);
      continue;
    }

    let current = '';
    const chunks = paragraph.match(/\S+\s*|\s+/g) ?? [paragraph];

    for (const chunk of chunks) {
      const candidate = current + chunk;
      if (safeWidth(font, candidate.trimEnd(), size) <= maxWidth || current === '') {
        if (safeWidth(font, candidate.trimEnd(), size) <= maxWidth) {
          current = candidate;
          continue;
        }
        // A single chunk wider than the box: break it character by character.
        let piece = '';
        for (const char of chunk) {
          if (safeWidth(font, piece + char, size) > maxWidth && piece !== '') {
            lines.push(piece);
            piece = char;
          } else {
            piece += char;
          }
        }
        current = piece;
        continue;
      }
      lines.push(current.trimEnd());
      current = chunk.replace(/^\s+/, '');
    }
    if (current !== '') lines.push(current.trimEnd());
  }

  return lines;
}
