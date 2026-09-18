import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { PDFFont } from 'pdf-lib';
import { isWinAnsiSafe, safeWidth, wrapText } from '../src/lib/pdf/fonts.ts';

/**
 * `wrapText` and `safeWidth` only ever ask a font how wide a string is, so a
 * stub with predictable metrics makes the wrapping decisions readable: every
 * character is exactly `size` points wide, which means "max 100pt at size 10"
 * reads as "10 characters per line".
 */
function monospaceFont(charWidth = 1): PDFFont {
  return {
    widthOfTextAtSize: (text: string, size: number) => text.length * size * charWidth,
  } as unknown as PDFFont;
}

/** A font that refuses characters it cannot encode, the way pdf-lib does. */
function winAnsiFont(): PDFFont {
  return {
    widthOfTextAtSize: (text: string, size: number) => {
      if (!isWinAnsiSafe(text)) throw new Error('cannot encode');
      return text.length * size;
    },
  } as unknown as PDFFont;
}

describe('isWinAnsiSafe', () => {
  it('accepts plain Latin text', () => {
    assert.equal(isWinAnsiSafe('Hello, world!'), true);
    assert.equal(isWinAnsiSafe(''), true);
  });

  it('accepts the Latin-1 range up to U+00FF', () => {
    assert.equal(isWinAnsiSafe('café naïve Ünicode ÿ'), true);
  });

  it('rejects Thai', () => {
    assert.equal(isWinAnsiSafe('สวัสดี'), false);
  });

  it('rejects a single non-Latin character in otherwise Latin text', () => {
    assert.equal(isWinAnsiSafe('price: 100฿'), false);
    assert.equal(isWinAnsiSafe('a — b'), false, 'em dash is U+2014');
  });

  it('rejects astral characters, counting them as one code point', () => {
    assert.equal(isWinAnsiSafe('🎉'), false);
  });
});

describe('safeWidth', () => {
  it('is zero for empty text without asking the font', () => {
    const exploding = { widthOfTextAtSize: () => { throw new Error('should not be called'); } } as unknown as PDFFont;
    assert.equal(safeWidth(exploding, '', 12), 0);
  });

  it('measures through the font when it can', () => {
    assert.equal(safeWidth(monospaceFont(), 'abcd', 10), 40);
  });

  it('falls back to an estimate rather than throwing on an unencodable glyph', () => {
    const width = safeWidth(winAnsiFont(), 'สวัสดี', 10);
    assert.ok(width > 0, 'an unmeasurable string must still get a width');
    assert.equal(width, 'สวัสดี'.length * 10 * 0.5);
  });
});

describe('wrapText', () => {
  const font = monospaceFont();

  it('leaves text that fits on one line', () => {
    assert.deepEqual(wrapText('short', font, 10, 100), ['short']);
  });

  it('honours explicit newlines', () => {
    assert.deepEqual(wrapText('one\ntwo', font, 10, 1000), ['one', 'two']);
  });

  it('keeps blank lines, so paragraph spacing survives the export', () => {
    assert.deepEqual(wrapText('a\n\nb', font, 10, 1000), ['a', '', 'b']);
  });

  it('breaks on whitespace and drops the trailing space', () => {
    // 10 chars per line at size 10 / maxWidth 100.
    assert.deepEqual(wrapText('aaaa bbbb cccc', font, 10, 100), ['aaaa bbbb', 'cccc']);
  });

  it('breaks a single word that is wider than the box, per character', () => {
    const lines = wrapText('aaaaaaaaaaaaaaa', font, 10, 100);
    assert.deepEqual(lines, ['aaaaaaaaaa', 'aaaaa']);
  });

  it('breaks Thai, which has no word spaces, per character', () => {
    const thai = 'สวัสดีชาวโลกนี่คือการทดสอบ';
    const lines = wrapText(thai, font, 10, 100);
    assert.ok(lines.length > 1, 'Thai must wrap even without spaces');
    for (const line of lines) {
      assert.ok(line.length <= 10, `line too long: ${line}`);
    }
    assert.equal(lines.join(''), thai, 'no characters may be lost');
  });

  it('breaks an over-long word even when it follows a short one', () => {
    // Regression: the character-level break used to run only for a chunk that
    // landed at the start of a line, so "quick" here escaped it and overflowed.
    // 3 characters per line at size 10 / maxWidth 30.
    for (const line of wrapText('the quick fox', font, 10, 30)) {
      assert.ok(line.length <= 3, `"${line}" overflows a 3-character box`);
    }
  });

  it('never returns a line wider than the box unless one character cannot fit', () => {
    const text = 'the quick brown fox jumps over the lazy dog';
    for (const maxWidth of [30, 50, 80, 120, 200]) {
      for (const line of wrapText(text, font, 10, maxWidth)) {
        assert.ok(
          line.length * 10 <= maxWidth || line.length === 1,
          `maxWidth ${maxWidth}: "${line}" overflows`,
        );
      }
    }
  });

  it('keeps every non-space character when wrapping Latin text', () => {
    const text = 'the quick brown fox jumps over the lazy dog';
    const wrapped = wrapText(text, font, 10, 70).join(' ');
    assert.equal(wrapped.replace(/\s+/g, ''), text.replace(/\s+/g, ''));
  });

  it('gives up wrapping rather than looping when the box is zero-width', () => {
    assert.deepEqual(wrapText('anything at all', font, 10, 0), ['anything at all']);
    assert.deepEqual(wrapText('anything at all', font, 10, -5), ['anything at all']);
  });

  it('returns a single empty line for empty text', () => {
    assert.deepEqual(wrapText('', font, 10, 100), ['']);
  });

  it('wraps text the font cannot measure instead of throwing', () => {
    const lines = wrapText('สวัสดีชาวโลก', winAnsiFont(), 10, 40);
    assert.ok(lines.length >= 1);
    assert.equal(lines.join(''), 'สวัสดีชาวโลก');
  });
});
