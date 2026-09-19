'use client';

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  type Locale,
  type Translate,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  createTranslator,
  isLocale,
} from './index';
import { LOCALE_COOKIE_MAX_AGE, localeFromAcceptLanguage } from './locales';

/**
 * The locale for client components.
 *
 * The site is a static export: one prerendered copy, in the default language,
 * served to everybody. So the locale is worked out in the browser — but *not*
 * on the render that hydrates that HTML, or an English reader's first paint
 * would disagree with the Thai markup React is attaching to. That is React
 * error #418, and it costs the whole page: React throws the server HTML away
 * and re-renders from scratch.
 *
 * `useSyncExternalStore` is the fix rather than a workaround: its third
 * argument is the value to use while hydrating, so the first render matches
 * the HTML by construction and the real locale lands on the render after.
 */

const LocaleContext = createContext<{ locale: Locale; t: Translate }>({
  locale: DEFAULT_LOCALE,
  t: createTranslator(DEFAULT_LOCALE),
});

/**
 * The locale, worked out from the browser alone.
 *
 * Exported for `global-error.tsx`, which renders when the root layout itself
 * has failed — there is no provider above it to ask.
 */
export function detectLocaleInBrowser(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const cookie = document.cookie
    .split(';')
    .map((part) => part.trim().split('='))
    .find(([name]) => name === LOCALE_COOKIE)?.[1];
  if (isLocale(cookie)) return cookie;
  return localeFromAcceptLanguage(navigator.language) ?? DEFAULT_LOCALE;
}

/** Nothing changes the locale without a reload, so there is nothing to watch. */
const subscribe = () => () => {};

export function LocaleProvider({
  locale,
  children,
}: {
  /** `'detect'` reads the cookie and the browser; anything else is taken as given. */
  locale: Locale | 'detect';
  children: React.ReactNode;
}) {
  const detected = useSyncExternalStore(subscribe, detectLocaleInBrowser, () => DEFAULT_LOCALE);
  const resolved = locale === 'detect' ? detected : locale;
  const value = useMemo(
    () => ({ locale: resolved, t: createTranslator(resolved) }),
    [resolved],
  );

  // A static export renders one `<html lang>` for everyone, so correct it here.
  // When the server resolved the locale the attribute already matches and this
  // is a no-op.
  useEffect(() => {
    if (document.documentElement.lang !== resolved) {
      document.documentElement.lang = resolved;
    }
  }, [resolved]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

/** `const t = useT()` — the shape every call site wants. */
export function useT(): Translate {
  return useContext(LocaleContext).t;
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

/**
 * Switches language without a round trip to a server the demo may not have:
 * the cookie is the store, and a reload picks it up on both sides.
 */
export function setLocale(next: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
  window.location.reload();
}
