import 'server-only';
import { cookies, headers } from 'next/headers';
import { type Locale, DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, localeFromAcceptLanguage } from './locales';
import { type Translate, createTranslator } from './index';

/**
 * The locale for a server render.
 *
 * An explicit choice wins over the browser's preference, and the browser's
 * preference wins over the default — so a first-time visitor from an
 * English-speaking browser gets English without having to find the switcher.
 */
export async function getLocale(): Promise<Locale> {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  return localeFromAcceptLanguage((await headers()).get('accept-language')) ?? DEFAULT_LOCALE;
}

export async function getTranslator(): Promise<Translate> {
  return createTranslator(await getLocale());
}

/** The same resolution for a route handler, which has the request in hand. */
export function localeFromRequest(request: Request): Locale {
  const cookie = request.headers
    .get('cookie')
    ?.split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === LOCALE_COOKIE)?.[1];
  if (isLocale(cookie)) return cookie;
  return localeFromAcceptLanguage(request.headers.get('accept-language')) ?? DEFAULT_LOCALE;
}

export function translatorForRequest(request: Request): Translate {
  return createTranslator(localeFromRequest(request));
}
