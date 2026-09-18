/**
 * The locales MeDF ships, and how one is chosen.
 *
 * Kept free of any message so both the server and the browser can import it
 * without pulling a dictionary in — the language switcher only needs the list.
 */

export const LOCALES = ['th', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'th';

/** Read and written by both sides, so the choice survives a reload. */
export const LOCALE_COOKIE = 'medf_locale';

/** A year: a language preference is not something to ask about again. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LOCALE_LABELS: Record<Locale, string> = {
  th: 'ไทย',
  en: 'English',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Picks a locale from an `Accept-Language` header.
 *
 * Quality values are honoured so `en;q=0.9, th;q=1.0` picks Thai. Anything
 * unrecognised falls through to the default rather than guessing.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const quality = params
        .map((param) => param.trim())
        .find((param) => param.startsWith('q='));
      return {
        // `th-TH` and `en-GB` both count.
        language: tag.trim().toLowerCase().split('-')[0],
        quality: quality ? Number.parseFloat(quality.slice(2)) : 1,
      };
    })
    .filter((entry) => Number.isFinite(entry.quality))
    .sort((a, b) => b.quality - a.quality);

  for (const entry of ranked) {
    if (isLocale(entry.language)) return entry.language;
  }
  return null;
}
