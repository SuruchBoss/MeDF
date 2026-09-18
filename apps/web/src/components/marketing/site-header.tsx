'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon, Logo } from '@/components/icons';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import type { MessageKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/provider';

/** Section links, as (href, message key) so the label follows the locale. */
const BASE_LINKS: { href: string; label: MessageKey }[] = [
  { href: '/#features', label: 'nav.features' },
  { href: '/#how', label: 'nav.howItWorks' },
  { href: '/#desktop', label: 'nav.windows' },
  { href: '/#faq', label: 'nav.faq' },
];

export function SiteHeader({
  signedIn,
  variant = 'product',
  tryHref = '/try',
  repoUrl = 'https://github.com/SuruchBoss/MeDF',
}: {
  signedIn: boolean;
  variant?: 'product' | 'demo';
  tryHref?: string;
  repoUrl?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const isDemo = variant === 'demo';
  // The demo has no `/pricing` route of its own; it links to the section.
  const plans = { href: isDemo ? '/#pricing' : '/pricing', label: 'nav.plans' as MessageKey };
  const links = [...BASE_LINKS.slice(0, 2), plans, ...BASE_LINKS.slice(2)];

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-white/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="text-ink-900">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-ink-100 hover:text-ink-900"
            >
              {t(link.label)}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitcher />
          {isDemo ? (
            <>
              <a href={repoUrl} className="btn-ghost" target="_blank" rel="noreferrer">
                GitHub
              </a>
              <Link href={tryHref} className="btn-primary">
                {t('nav.tryNow')}
                <Icon name="arrow-right" size={16} />
              </Link>
            </>
          ) : signedIn ? (
            <Link href="/app" className="btn-primary">
              {t('nav.toWorkspace')}
              <Icon name="arrow-right" size={16} />
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                {t('nav.login')}
              </Link>
              <Link href="/register" className="btn-primary">
                {t('nav.signUpFree')}
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="btn-ghost md:hidden"
          aria-label={t('nav.openMenu')}
          aria-expanded={open}
        >
          <Icon name={open ? 'x' : 'menu'} size={22} />
        </button>
      </div>

      {open ? (
        <div className="border-t border-ink-200 bg-white md:hidden">
          <div className="container-page flex flex-col gap-1 py-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-100"
              >
                {t(link.label)}
              </Link>
            ))}
            <LanguageSwitcher className="mt-1 self-start" />
            <div className="mt-2 flex gap-2">
              {isDemo ? (
                <Link href={tryHref} className="btn-primary flex-1" onClick={() => setOpen(false)}>
                  {t('nav.tryNow')}
                </Link>
              ) : signedIn ? (
                <Link href="/app" className="btn-primary flex-1">
                  {t('nav.toWorkspace')}
                </Link>
              ) : (
                <>
                  <Link href="/login" className="btn-secondary flex-1">
                    {t('nav.login')}
                  </Link>
                  <Link href="/register" className="btn-primary flex-1">
                    {t('nav.signUpFree')}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
