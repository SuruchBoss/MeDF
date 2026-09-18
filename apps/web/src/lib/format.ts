import type { Locale } from './i18n/locales';

/**
 * Formatting helpers shared by client components.
 *
 * Dates and relative times go through `Intl` rather than hand-written phrases:
 * it already knows how each language says "3 hours ago", including the plural
 * rules we would otherwise have to encode by hand.
 */

const INTL_LOCALE: Record<Locale, string> = { th: 'th-TH', en: 'en-GB' };

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function formatDateTime(iso: string, locale: Locale = 'th'): string {
  return new Date(iso).toLocaleString(INTL_LOCALE[locale], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(iso: string, locale: Locale = 'th'): string {
  return new Date(iso).toLocaleDateString(INTL_LOCALE[locale], {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Steps from smallest to largest, so the first one that fits is used. */
const RELATIVE_STEPS: [limit: number, unit: Intl.RelativeTimeFormatUnit, per: number][] = [
  [60, 'minute', 1],
  [24, 'hour', 60],
  [30, 'day', 60 * 24],
];

export function formatRelative(iso: string, locale: Locale = 'th'): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: 'auto' }).format(0, 'minute');

  const relative = new Intl.RelativeTimeFormat(INTL_LOCALE[locale], { numeric: 'always' });
  for (const [limit, unit, per] of RELATIVE_STEPS) {
    const value = Math.round(minutes / per);
    if (value < limit) return relative.format(-value, unit);
  }
  // Older than a month: an absolute date is more useful than "2 months ago".
  return formatDate(iso, locale);
}
