'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon, Spinner } from '@/components/icons';
import { formatMoney } from '@/lib/i18n/format';
import { useLocale, useT } from '@/lib/i18n/provider';
import {
  type BillingInterval,
  type PlanId,
  PLAN_ORDER,
  PLANS,
  yearlySavingPercent,
} from '@/lib/plans';

interface PricingTableProps {
  /** Highlights the member's current plan and switches the copy to "billing" mode. */
  currentPlan?: PlanId;
  /** Present on the billing screen; absent on marketing pages. */
  onChoose?: (plan: PlanId, interval: BillingInterval) => void;
  busyPlan?: PlanId | null;
  /** The static demo has no sign-up, so its buttons lead to the editor. */
  demo?: boolean;
  tryHref?: string;
}

export function PricingTable({
  currentPlan,
  onChoose,
  busyPlan = null,
  demo = false,
  tryHref = '/try',
}: PricingTableProps) {
  const t = useT();
  const locale = useLocale();
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const saving = yearlySavingPercent(PLANS.pro);

  return (
    <div>
      <div className="flex justify-center">
        <div
          className="inline-flex rounded-xl border border-ink-200 bg-white p-1"
          role="group"
          aria-label={t('pricing.billingCycle')}
        >
          {(['monthly', 'yearly'] as BillingInterval[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setInterval(option)}
              aria-pressed={interval === option}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition pointer-coarse:min-h-11 ${
                interval === option
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-ink-600 hover:text-ink-900'
              }`}
            >
              {option === 'monthly'
                ? t('pricing.monthly')
                : t('pricing.yearly', { percent: saving })}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {PLAN_ORDER.map((planId) => {
          const plan = PLANS[planId];
          const price = plan.price[interval];
          const isCurrent = currentPlan === planId;
          const busy = busyPlan === planId;

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
              {isCurrent ? (
                <span className="badge absolute -top-3 right-6 bg-emerald-700 text-white">
                  {t('pricing.currentPlan')}
                </span>
              ) : null}

              <h3 className="text-lg font-bold text-ink-900">{plan.name}</h3>
              <p className="mt-1 text-sm text-ink-500">{t(plan.tagline)}</p>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold tracking-tight text-ink-900">
                  {price === 0 ? t('pricing.free') : formatMoney(price, locale)}
                </span>
                {price > 0 ? (
                  <span className="text-sm text-ink-500">
                    / {interval === 'monthly' ? t('pricing.perMonth') : t('pricing.perYear')}
                  </span>
                ) : null}
              </div>
              {price > 0 && interval === 'yearly' ? (
                <p className="mt-1 text-xs text-emerald-600">
                  {t('pricing.perMonthEquivalent', {
                    amount: formatMoney(Math.round(price / 12), locale),
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
                {onChoose ? (
                  isCurrent ? (
                    <button type="button" className="btn-secondary w-full" disabled>
                      {t('pricing.onThisPlan')}
                    </button>
                  ) : planId === 'free' ? (
                    <p className="text-center text-xs text-ink-500">
                      {t('pricing.downgradeNote')}
                    </p>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary w-full"
                      onClick={() => onChoose(planId, interval)}
                      disabled={busy}
                    >
                      {busy ? <Spinner size={16} /> : null}
                      {currentPlan && currentPlan !== 'free'
                        ? t('pricing.changeToThis')
                        : t('pricing.subscribe')}
                    </button>
                  )
                ) : (
                  <Link
                    // Every plan leads to the editor: there is nowhere to sign
                    // up any more, and a licence is bought outside the app.
                    href={tryHref}
                    className={plan.highlight ? 'btn-primary w-full' : 'btn-secondary w-full'}
                  >
                    {planId === 'free' ? t('nav.tryNow') : t('pricing.tryTools')}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-ink-500">
        {demo ? t('pricing.demoNote') : t('pricing.taxNote')}
      </p>
    </div>
  );
}
