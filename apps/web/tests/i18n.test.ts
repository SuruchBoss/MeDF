import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { LOCALES, createTranslator, isLocale, localeFromAcceptLanguage } from '../src/lib/i18n/index.ts';
import { en } from '../src/lib/i18n/en.ts';
import { th } from '../src/lib/i18n/th.ts';

const THAI = /[฀-๿]/;

describe('the dictionaries', () => {
  it('cover exactly the same keys', () => {
    // `en` is typed `Record<MessageKey, string>`, so a missing key is already a
    // compile error. This catches the other direction: a key only in English.
    assert.deepEqual(Object.keys(en).sort(), Object.keys(th).sort());
  });

  it('leave no message empty', () => {
    for (const [key, value] of Object.entries({ ...th, ...en })) {
      assert.ok(value.trim().length > 0, `${key} is empty`);
    }
  });

  it('use the same placeholders in both languages', () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(th) as (keyof typeof th)[]) {
      assert.deepEqual(
        placeholders(en[key]),
        placeholders(th[key]),
        `${key}: the two languages interpolate different names`,
      );
    }
  });

  it('has no Thai left in the English dictionary', () => {
    for (const [key, value] of Object.entries(en)) {
      // `font.sarabun` names the script, so it is allowed to say "Thai".
      if (key === 'font.sarabun') continue;
      assert.ok(!THAI.test(value), `${key} still reads Thai: ${value}`);
    }
  });
});

describe('interpolation', () => {
  const t = createTranslator('en');

  it('substitutes named values', () => {
    assert.equal(t('error.reference', { digest: 'abc123' }), 'Reference: abc123');
  });

  it('leaves an unknown placeholder alone rather than printing undefined', () => {
    assert.equal(t('error.reference', {}), 'Reference: {digest}');
  });

  it('accepts numbers as well as strings', () => {
    assert.ok(t('props.selectedCount', { count: 3 }).includes('3'));
  });
});

describe('locale negotiation', () => {
  it('accepts only the locales we ship', () => {
    for (const locale of LOCALES) assert.ok(isLocale(locale));
    assert.ok(!isLocale('fr'));
    assert.ok(!isLocale(''));
    assert.ok(!isLocale(undefined));
  });

  it('matches a region tag to its language', () => {
    assert.equal(localeFromAcceptLanguage('en-GB'), 'en');
    assert.equal(localeFromAcceptLanguage('th-TH'), 'th');
  });

  it('honours quality values rather than header order', () => {
    assert.equal(localeFromAcceptLanguage('en;q=0.8, th;q=1.0'), 'th');
    assert.equal(localeFromAcceptLanguage('th;q=0.2, en;q=0.9'), 'en');
  });

  it('returns null for a header with nothing we speak', () => {
    assert.equal(localeFromAcceptLanguage('fr-FR, de;q=0.8'), null);
    assert.equal(localeFromAcceptLanguage(''), null);
    assert.equal(localeFromAcceptLanguage(null), null);
  });

  it('ignores a malformed quality value instead of ranking it first', () => {
    assert.equal(localeFromAcceptLanguage('en;q=oops, th;q=0.5'), 'th');
  });
});

/**
 * The real guard: a Thai string typed straight into a component compiles and
 * renders, and would simply never appear in English. This is what stops that
 * happening again.
 */
describe('no untranslated Thai in the source', () => {
  const root = path.join(import.meta.dirname, '..', 'src');

  /** Places Thai is correct: the dictionary, a language name, Thai SEO terms. */
  const ALLOWED = new Set([
    path.join('lib', 'i18n', 'th.ts'),
    path.join('lib', 'i18n', 'locales.ts'),
    path.join('lib', 'i18n', 'format.ts'),
    path.join('lib', 'pdf', 'sample-document.ts'),
    path.join('app', 'layout.tsx'),
  ]);

  function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return /\.tsx?$/.test(entry.name) ? [full] : [];
    });
  }

  it('keeps every Thai string in the dictionary', () => {
    const offenders: string[] = [];
    for (const file of walk(root)) {
      const relative = path.relative(root, file);
      if (ALLOWED.has(relative)) continue;
      for (const [index, line] of fs.readFileSync(file, 'utf8').split('\n').entries()) {
        if (THAI.test(line)) offenders.push(`${relative}:${index + 1}: ${line.trim()}`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `Thai text outside the dictionary:\n${offenders.join('\n')}`,
    );
  });
});
