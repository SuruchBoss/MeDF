'use client';

import Link from 'next/link';
import { Icon, type IconName } from '@/components/icons';
import { EditorPreview } from '@/components/marketing/editor-preview';
import { PricingTable } from '@/components/marketing/pricing-table';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';
import type { MessageKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/provider';

/**
 * The marketing page, shared by two deployments:
 *
 *   `product` — the full app, where visitors can sign up and sign in.
 *   `demo`    — the static build published to GitHub Pages. It has no server,
 *               so sign-up is replaced by the browser-only editor and links to
 *               the source.
 *
 * Keeping one component means the public page and the product page cannot drift.
 */

export interface LandingProps {
  variant?: 'product' | 'demo';
  signedIn?: boolean;
  /** Where the "try it now" button goes (the no-signup editor). */
  tryHref?: string;
  repoUrl?: string;
}

const FEATURES: { icon: IconName; title: MessageKey; body: MessageKey }[] = [
  { icon: 'cursor', title: 'landing.feature.drag.title', body: 'landing.feature.drag.body' },
  { icon: 'grid', title: 'landing.feature.resize.title', body: 'landing.feature.resize.body' },
  { icon: 'text', title: 'landing.feature.thai.title', body: 'landing.feature.thai.body' },
  { icon: 'pen', title: 'landing.feature.sign.title', body: 'landing.feature.sign.body' },
  { icon: 'layers', title: 'landing.feature.pages.title', body: 'landing.feature.pages.body' },
  { icon: 'download', title: 'landing.feature.export.title', body: 'landing.feature.export.body' },
];

const STEPS: { title: MessageKey; body: MessageKey }[] = [
  { title: 'landing.step.upload.title', body: 'landing.step.upload.body' },
  { title: 'landing.step.edit.title', body: 'landing.step.edit.body' },
  { title: 'landing.step.export.title', body: 'landing.step.export.body' },
];

const FAQ: { q: MessageKey; a: MessageKey }[] = [
  { q: 'landing.faq.editText.q', a: 'landing.faq.editText.a' },
  { q: 'landing.faq.storage.q', a: 'landing.faq.storage.a' },
  { q: 'landing.faq.thai.q', a: 'landing.faq.thai.a' },
  { q: 'landing.faq.offline.q', a: 'landing.faq.offline.a' },
  { q: 'landing.faq.cancel.q', a: 'landing.faq.cancel.a' },
];

export function Landing({
  variant = 'product',
  signedIn = false,
  tryHref = '/try',
  repoUrl = 'https://github.com/SuruchBoss/MeDF',
}: LandingProps) {
  const t = useT();
  const isDemo = variant === 'demo';
  // In the demo there is no account to create, so the primary action is the
  // editor itself.
  const primary: { href: string; label: MessageKey } = isDemo
    ? { href: tryHref, label: 'landing.hero.primaryDemo' }
    : signedIn
      ? { href: '/app', label: 'landing.hero.primaryWorkspace' }
      : { href: '/register', label: 'landing.hero.primaryRegister' };

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader signedIn={signedIn} variant={variant} tryHref={tryHref} repoUrl={repoUrl} />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-ink-200 bg-gradient-to-b from-white via-brand-50/50 to-ink-50">
          <div
            className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[52rem] -translate-x-1/2 rounded-full bg-brand-300/25 blur-3xl"
            aria-hidden="true"
          />
          <div className="container-page relative grid gap-12 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
            <div>
              <span className="badge border border-brand-200 bg-white text-brand-700">
                <Icon name="sparkles" size={13} />
                {t('landing.badge')}
              </span>
              <h1 className="mt-5 text-4xl leading-[1.15] font-extrabold tracking-tight text-ink-900 sm:text-5xl">
                <span className="block">{t('landing.hero.line1')}</span>
                <span className="block text-brand-600">{t('landing.hero.line2')}</span>
                <span className="block">{t('landing.hero.line3')}</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600">
                {t('landing.hero.body')}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={primary.href} className="btn-primary px-5 py-3 text-base">
                  {t(primary.label)}
                  <Icon name="arrow-right" size={18} />
                </Link>
                {isDemo ? (
                  <a href={repoUrl} className="btn-secondary px-5 py-3 text-base" target="_blank" rel="noreferrer">
                    <Icon name="file-text" size={18} />
                    {t('landing.hero.secondarySource')}
                  </a>
                ) : (
                  <Link href={tryHref} className="btn-secondary px-5 py-3 text-base">
                    <Icon name="cursor" size={18} />
                    {t('landing.hero.secondaryTry')}
                  </Link>
                )}
              </div>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-5">
                {(
                  [
                    ['landing.stat.elements', 'landing.stat.elementsValue'],
                    ['landing.stat.precision', null],
                    ['landing.stat.quality', 'landing.stat.qualityValue'],
                  ] as [MessageKey, MessageKey | null][]
                ).map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-ink-500">{t(label)}</dt>
                    <dd className="text-lg font-bold text-ink-900">{value ? t(value) : '0.1 pt'}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="lg:pl-4">
              <EditorPreview />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 py-20">
          <div className="container-page">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
                {t('landing.features.title')}
              </h2>
              <p className="mt-4 text-ink-600">
                {t('landing.features.body')}
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="card p-6 transition hover:shadow-md">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Icon name={feature.icon} size={21} />
                  </span>
                  <h3 className="mt-4 font-bold text-ink-900">{t(feature.title)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{t(feature.body)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 border-y border-ink-200 bg-white py-20">
          <div className="container-page">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
                {t('landing.steps.title')}
              </h2>
              <p className="mt-4 text-ink-600">{t('landing.steps.body')}</p>
            </div>

            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative rounded-2xl bg-ink-50 p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-bold text-ink-900">{t(step.title)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{t(step.body)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Windows desktop */}
        <section id="desktop" className="scroll-mt-20 py-20">
          <div className="container-page grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="badge border border-ink-200 bg-white text-ink-700">
                <Icon name="monitor" size={13} />
                Windows 10 / 11 · 64-bit
              </span>
              <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
                {t('landing.win.title')}
              </h2>
              <p className="mt-4 leading-relaxed text-ink-600">
                {t('landing.win.body')}
              </p>
              <ul className="mt-6 space-y-3">
                {(
                  [
                    'landing.win.point.admin',
                    'landing.win.point.shortcuts',
                    'landing.win.point.contextMenu',
                    'landing.win.point.data',
                  ] as MessageKey[]
                ).map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm text-ink-700">
                    <Icon name="check" size={17} className="mt-0.5 shrink-0 text-emerald-600" />
                    <span>{t(item)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                {isDemo ? (
                  <a
                    href={`${repoUrl}/releases`}
                    className="btn-primary"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t('landing.win.download')}
                  </a>
                ) : (
                  <Link href="/register" className="btn-primary">
                    {t('landing.win.registerForLink')}
                  </Link>
                )}
                <a
                  href={`${repoUrl}/releases`}
                  className="btn-secondary"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('landing.win.allReleases')}
                </a>
              </div>
              <p className="mt-3 text-xs text-ink-500">
                {t('landing.win.buildYourself')}{' '}
                <code className="rounded bg-ink-100 px-1.5 py-0.5">npm run dist:win</code>
              </p>
            </div>

            <div className="card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-ink-200 bg-ink-900 px-4 py-2.5 text-ink-100">
                <Icon name="monitor" size={15} />
                <span className="text-xs font-medium">MeDF Setup 1.0.0</span>
              </div>
              <div className="space-y-4 p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Icon name="download" size={22} />
                  </span>
                  <div>
                    <p className="font-semibold text-ink-900">MeDF-Setup-1.0.0-x64.exe</p>
                    <p className="text-xs text-ink-500">{t('landing.win.installerFor')}</p>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full w-2/3 rounded-full bg-brand-500" />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {(
                    [
                      ['landing.win.spec.type', 'NSIS installer'],
                      ['landing.win.spec.arch', 'x64'],
                      ['landing.win.spec.internet', t('landing.win.spec.internetValue')],
                      ['landing.win.spec.storage', '%APPDATA%\\MeDF'],
                    ] as [MessageKey, string][]
                  ).map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-ink-50 px-3 py-2">
                      <p className="text-ink-500">{t(label)}</p>
                      <p className="font-semibold text-ink-800">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 border-y border-ink-200 bg-white py-20">
          <div className="container-page">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
                {t('landing.pricing.title')}
              </h2>
              <p className="mt-4 text-ink-600">
                {t('landing.pricing.body')}
              </p>
            </div>
            <div className="mt-10">
              <PricingTable signedIn={signedIn} demo={isDemo} tryHref={tryHref} />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 py-20">
          <div className="container-page max-w-3xl">
            <h2 className="text-center text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              {t('landing.faq.title')}
            </h2>
            <div className="mt-10 space-y-3">
              {FAQ.map((item) => (
                <details key={item.q} className="card group p-5">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold text-ink-900">
                    {t(item.q)}
                    <Icon
                      name="chevron-down"
                      size={18}
                      className="shrink-0 text-ink-400 transition group-open:rotate-180"
                    />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-ink-600">{t(item.a)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="pb-20">
          <div className="container-page">
            <div className="relative overflow-hidden rounded-3xl bg-ink-900 px-8 py-14 text-center">
              <div
                className="pointer-events-none absolute -bottom-24 left-1/2 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-brand-500/30 blur-3xl"
                aria-hidden="true"
              />
              <h2 className="relative text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                {t('landing.cta.title')}
              </h2>
              <p className="relative mx-auto mt-4 max-w-xl text-ink-300">
                {t('landing.cta.body')}
              </p>
              <div className="relative mt-8 flex justify-center gap-3">
                <Link href={primary.href} className="btn-primary px-5 py-3 text-base">
                  {isDemo
                    ? t('landing.cta.demoOpen')
                    : signedIn
                      ? t('landing.cta.toDocuments')
                      : t('landing.cta.register')}
                </Link>
                {isDemo ? (
                  <a
                    href={repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn px-5 py-3 text-base text-white ring-1 ring-white/25 hover:bg-white/10"
                  >
                    {t('landing.cta.demoSource')}
                  </a>
                ) : (
                  <Link
                    href="/pricing"
                    className="btn px-5 py-3 text-base text-white ring-1 ring-white/25 hover:bg-white/10"
                  >
                    {t('landing.cta.seePlans')}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter variant={variant} repoUrl={repoUrl} tryHref={tryHref} />
    </div>
  );
}
