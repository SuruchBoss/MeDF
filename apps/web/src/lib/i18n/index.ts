import { DEFAULT_LOCALE, type Locale } from './locales';
import { en } from './en';
import { th } from './th';

/**
 * Message lookup.
 *
 * `th` is the source dictionary and defines the key set; `en` is typed as
 * `Record<MessageKey, string>`, so a key added to Thai and forgotten in English
 * is a compile error rather than a string that silently shows in the wrong
 * language.
 *
 * Interpolation is `{name}` — deliberately the smallest thing that works.
 * Anything needing plural rules or dates goes through `Intl` at the call site,
 * where the locale is already in hand.
 */

export type MessageKey = keyof typeof th;
export type MessageParams = Record<string, string | number>;

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { th, en };

export type Translate = (key: MessageKey, params?: MessageParams) => string;

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

/** Builds the `t` function for one locale. */
export function createTranslator(locale: Locale): Translate {
  const dictionary = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
  return (key, params) => {
    // Falling back to Thai beats showing a raw key: the key set is checked at
    // compile time, so this only fires if a dictionary is somehow incomplete.
    const template = dictionary[key] ?? DICTIONARIES[DEFAULT_LOCALE][key] ?? key;
    return interpolate(template, params);
  };
}

export {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_LABELS,
  isLocale,
  localeFromAcceptLanguage,
} from './locales';
export type { Locale } from './locales';
