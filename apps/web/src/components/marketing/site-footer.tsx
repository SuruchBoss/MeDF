'use client';

import Link from 'next/link';
import { Logo } from '@/components/icons';
import { useT } from '@/lib/i18n/provider';

export function SiteFooter({
  variant = 'product',
  repoUrl = 'https://github.com/SuruchBoss/MeDF',
  tryHref = '/try',
}: {
  variant?: 'product' | 'demo';
  repoUrl?: string;
  tryHref?: string;
}) {
  const t = useT();
  const isDemo = variant === 'demo';

  return (
    <footer className="border-t border-ink-200 bg-white">
      <div className="container-page grid gap-10 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-500">{t('footer.tagline')}</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink-900">{t('footer.product')}</h3>
          <ul className="mt-2 space-y-0.5 text-sm text-ink-500 [&_a]:inline-block [&_a]:py-1.5 pointer-coarse:[&_a]:py-3">
            <li>
              <Link href="/#features" className="hover:text-ink-900">
                {t('footer.allFeatures')}
              </Link>
            </li>
            <li>
              <Link href={isDemo ? '/#pricing' : '/pricing'} className="hover:text-ink-900">
                {t('footer.plansAndPricing')}
              </Link>
            </li>
            <li>
              <Link href="/#desktop" className="hover:text-ink-900">
                {t('footer.windowsVersion')}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink-900">
            {isDemo ? t('footer.openSource') : t('footer.account')}
          </h3>
          <ul className="mt-2 space-y-0.5 text-sm text-ink-500 [&_a]:inline-block [&_a]:py-1.5 pointer-coarse:[&_a]:py-3">
            {isDemo ? (
              <>
                <li>
                  <Link href={tryHref} className="hover:text-ink-900">
                    {t('footer.tryNoSignup')}
                  </Link>
                </li>
                <li>
                  <a href={repoUrl} className="hover:text-ink-900" target="_blank" rel="noreferrer">
                    {t('footer.sourceOnGitHub')}
                  </a>
                </li>
                <li>
                  <a
                    href={`${repoUrl}/blob/main/docs/OPEN_CORE.md`}
                    className="hover:text-ink-900"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('footer.openCoreModel')}
                  </a>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link href="/register" className="hover:text-ink-900">
                    {t('footer.register')}
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-ink-900">
                    {t('footer.login')}
                  </Link>
                </li>
                <li>
                  <Link href="/app/billing" className="hover:text-ink-900">
                    {t('footer.manageSubscription')}
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-100">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-ink-500 sm:flex-row">
          <p>{t('footer.rights', { year: new Date().getFullYear() })}</p>
          <p>{t('footer.fontLicence')}</p>
        </div>
      </div>
    </footer>
  );
}
