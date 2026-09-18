import type { Locale } from './locales';

/**
 * Number and money formatting.
 *
 * Kept apart from the dictionaries because these are `Intl` calls, not
 * translations — the rules come from the locale, not from a phrase someone
 * wrote. Thai reads ฿249, English reads THB 249: same money, and both are what
 * a reader of that language expects to see.
 */

const MONEY_LOCALE: Record<Locale, string> = { th: 'th-TH', en: 'en-US' };
const NUMBER_LOCALE: Record<Locale, string> = { th: 'th-TH', en: 'en-US' };

export function formatMoney(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(MONEY_LOCALE[locale], {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * A quota as a number, or `null` when it is unlimited.
 *
 * `null` rather than a word, so this stays a pure formatting function: the
 * caller already has `t` and renders `t('common.unlimited')` itself.
 */
export function formatCount(value: number, locale: Locale): string | null {
  if (!Number.isFinite(value)) return null;
  return new Intl.NumberFormat(NUMBER_LOCALE[locale]).format(value);
}
