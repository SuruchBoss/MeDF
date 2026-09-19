'use client';

import Link from 'next/link';
import { Icon } from '@/components/icons';
import { formatMoney } from '@/lib/i18n/format';
import { useLocale, useT } from '@/lib/i18n/provider';
import { PLAN_ORDER, PLANS } from '@/lib/plans';

interface PricingTableProps {
  /** The demo build's buttons lead to its own editor path. */
  tryHref?: string;
}

/**
 * Two cards, one price each. There is no monthly/yearly switch because the
 * licence is bought once — the yearly number buys updates, not access, so it
 * is a footnote rather than a second column.
 */
export function PricingTable({ tryHref = '/try' }: PricingTableProps) {
  const t = useT();
  const locale = useLocale();

  return (
    <div>
      <div className="mx-auto mt-2 grid max-w-3xl gap-6 md:grid-cols-2">
        {PLAN_ORDER.map((planId) => {
          const plan = PLANS[planId];
          const price = plan.price.licence;

          return (
            <div
              key={plan.id}
              className={`card relative flex flex-col p-6 ${
                plan.highlight ? 'ring-2 ring-brand-500' : ''
              }`}
            >
              {plan.highlight ? (
                <span className="badge absolute -top-3 left-6 bg-brand-600 text-white">
                  <Icon name="star" size={12} />
                  {t('pricing.recommended')}
                </span>
              ) : null}
              <h3 className="text-lg font-bold text-ink-900">{plan.name}</h3>
              <p className="mt-1 text-sm text-ink-500">{t(plan.tagline)}</p>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold tracking-tight text-ink-900">
                  {price === 0 ? t('pricing.free') : formatMoney(price, locale)}
                </span>
                {price > 0 ? (
                  <span className="text-sm text-ink-500">{t('pricing.licenceOnce')}</span>
                ) : null}
              </div>
              {plan.price.renewal > 0 ? (
                <p className="mt-1 text-xs text-ink-500">
                  {t('pricing.renewalNote', {
                    amount: formatMoney(plan.price.renewal, locale),
                  })}
                </p>
              ) : null}

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-sm text-ink-600">
                    <Icon name="check" size={16} className="mt-0.5 shrink-0 text-brand-600" />
                    <span>{t(feature)}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-7">
                <Link
                  href={tryHref}
                  className={plan.highlight ? 'btn-primary w-full' : 'btn-secondary w-full'}
                >
                  {planId === 'free' ? t('nav.tryNow') : t('pricing.tryTools')}
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-ink-500">
        {t('pricing.taxNote')}
      </p>
    </div>
  );
}
