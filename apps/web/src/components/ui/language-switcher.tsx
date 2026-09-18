'use client';

import { Icon } from '@/components/icons';
import { LOCALES, LOCALE_LABELS } from '@/lib/i18n';
import { setLocale, useLocale, useT } from '@/lib/i18n/provider';

/**
 * Language picker.
 *
 * A `<select>` rather than a menu: it is two options, it works before
 * hydration finishes, and it is the control a screen reader already knows.
 */
export function LanguageSwitcher({ className = '' }: { className?: string }) {
  const locale = useLocale();
  const t = useT();

  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">{t('common.language')}</span>
      <Icon
        name="globe"
        size={15}
        className="pointer-events-none absolute left-2.5 text-ink-400"
      />
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as (typeof LOCALES)[number])}
        className="cursor-pointer appearance-none rounded-lg border border-transparent bg-transparent py-2 pr-2 pl-7 text-sm font-medium text-ink-600 transition hover:bg-ink-100 hover:text-ink-900 focus-visible:border-brand-400 focus-visible:outline-none"
      >
        {LOCALES.map((option) => (
          <option key={option} value={option}>
            {LOCALE_LABELS[option]}
          </option>
        ))}
      </select>
    </label>
  );
}
