'use client';

import Link from 'next/link';
import { Icon } from '@/components/icons';
import { PricingTable } from '@/components/marketing/pricing-table';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';
import type { Locale, MessageKey, Translate } from '@/lib/i18n';
import { formatCount } from '@/lib/i18n/format';
import { useLocale, useT } from '@/lib/i18n/provider';
import { type Plan, PLANS, PLAN_ORDER } from '@/lib/plans';

/**
 * A client component: the site is a static export, so the reader's language
 * is resolved in the browser. The page title comes from the root layout.
 */

/** One row of the comparison table, rendered per plan. */
interface ComparisonRow {
  label: MessageKey;
  value: (plan: Plan, t: Translate, locale: Locale) => string;
}

/** `formatCount` returns null for an unlimited allowance; the word is ours. */
function count(value: number, t: Translate, locale: Locale): string {
  return formatCount(value, locale) ?? t('common.unlimited');
}

const COMPARISON: ComparisonRow[] = [
  {
    label: 'pricingPage.row.editText',
    value: (plan, t) => (plan.limits.editOriginalText ? t('common.yes') : t('common.no')),
  },
  {
    label: 'pricingPage.row.watermark',
    value: (plan, t) => (plan.limits.watermark ? t('common.yes') : t('common.no')),
  },
  { label: 'pricingPage.row.uploadSize', value: (plan) => `${plan.limits.maxUploadMb} MB` },
  {
    label: 'pricingPage.row.pages',
    value: (plan, t, locale) =>
      t('pricingPage.row.pagesValue', { count: count(plan.limits.maxPages, t, locale) }),
  },
  {
    label: 'pricingPage.row.images',
    value: (plan, t) =>
      plan.limits.highQualityImages
        ? t('pricingPage.row.imagesFull')
        : t('pricingPage.row.imagesCompressed'),
  },
];

export default function PricingPage() {
  const t = useT();
  const locale = useLocale();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader signedIn={false} />

      <main className="flex-1">
        <section className="border-b border-ink-200 bg-gradient-to-b from-brand-50/60 to-ink-50 py-16">
          <div className="container-page text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-ink-900">
              {t('pricingPage.title')}
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-ink-600">{t('pricingPage.intro')}</p>
          </div>
        </section>

        <section className="py-14">
          <div className="container-page">
            {/* The cards inside are h3. Without this the page would run h1 → h3,
                which reads to a screen reader as a missing level. */}
            <h2 className="sr-only">{t('pricingPage.plans')}</h2>
            <PricingTable />
          </div>
        </section>

        <section className="border-t border-ink-200 bg-white py-14">
          <div className="container-page">
            <h2 className="text-2xl font-bold text-ink-900">{t('pricingPage.compare')}</h2>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[42rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-left">
                    <th className="py-3 pr-4 font-semibold text-ink-500">
                      {t('pricingPage.feature')}
                    </th>
                    {PLAN_ORDER.map((planId) => (
                      <th key={planId} className="py-3 pr-4 font-bold text-ink-900">
                        {PLANS[planId].name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.label} className="border-b border-ink-100">
                      <td className="py-3 pr-4 text-ink-600">{t(row.label)}</td>
                      {PLAN_ORDER.map((planId) => (
                        <td key={planId} className="py-3 pr-4 font-medium text-ink-900">
                          {row.value(PLANS[planId], t, locale)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3 rounded-2xl bg-ink-50 p-6">
              <Icon name="shield" size={22} className="text-brand-600" />
              <p className="flex-1 text-sm text-ink-600">{t('pricingPage.unsure')}</p>
              <Link href="/try" className="btn-primary">
                {t('pricing.startFree')}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
