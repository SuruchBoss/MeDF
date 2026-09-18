'use client';

import { createContext, useContext, useEffect, useMemo } from 'react';
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
 * The server resolves it and seeds the provider, so the first client render
 * matches the HTML it is hydrating — a mismatch here would be a hydration
 * error on every page. The static demo has no server to ask, so it passes
 * `detect` and the provider works it out from the browser instead.
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

export function LocaleProvider({
  locale,
  children,
}: {
  /** `'detect'` is for the static export, which has no server render. */
  locale: Locale | 'detect';
  children: React.ReactNode;
}) {
  const resolved = locale === 'detect' ? detectLocaleInBrowser() : locale;
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
