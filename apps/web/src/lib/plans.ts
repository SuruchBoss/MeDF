/**
 * Plan catalogue. Shared by the marketing pages, the billing screens and the
 * server-side quota checks, so pricing only ever lives in one place.
 *
 * The copy is message keys, not text: the same table drives both languages,
 * and the compiler rejects a key that has no translation. Plan *names* stay as
 * they are — Free, Pro and Team read the same either way.
 */

import type { MessageKey } from './i18n';

export type PlanId = 'free' | 'pro' | 'team';
export type BillingInterval = 'monthly' | 'yearly';
export type PlanStatus = 'active' | 'trialing' | 'canceled' | 'past_due';

export interface PlanLimits {
  /** Documents a member may keep at once. */
  maxDocuments: number;
  /** Largest PDF upload, in megabytes. */
  maxUploadMb: number;
  /** Largest page count per document. */
  maxPages: number;
  /** Exports allowed per calendar month (`Infinity` for unlimited). */
  exportsPerMonth: number;
  /** Free plan exports carry a small MeDF footer. */
  watermark: boolean;
  /** Export without the original PDF text layer being rasterised. */
  highQualityImages: boolean;
  prioritySupport: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: MessageKey;
  price: Record<BillingInterval, number>;
  currency: 'THB';
  limits: PlanLimits;
  features: MessageKey[];
  highlight?: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'plan.free.tagline',
    price: { monthly: 0, yearly: 0 },
    currency: 'THB',
    limits: {
      maxDocuments: 3,
      maxUploadMb: 10,
      maxPages: 20,
      exportsPerMonth: 10,
      watermark: true,
      highQualityImages: false,
      prioritySupport: false,
    },
    features: [
      'plan.free.feature.documents',
      'plan.free.feature.upload',
      'plan.free.feature.exports',
      'plan.free.feature.tools',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'plan.pro.tagline',
    price: { monthly: 249, yearly: 2490 },
    currency: 'THB',
    limits: {
      maxDocuments: 200,
      maxUploadMb: 50,
      maxPages: 300,
      exportsPerMonth: Number.POSITIVE_INFINITY,
      watermark: false,
      highQualityImages: true,
      prioritySupport: false,
    },
    features: [
      'plan.pro.feature.documents',
      'plan.pro.feature.upload',
      'plan.pro.feature.exports',
      'plan.pro.feature.images',
      'plan.pro.feature.pages',
    ],
    highlight: true,
  },
  team: {
    id: 'team',
    name: 'Team',
    tagline: 'plan.team.tagline',
    price: { monthly: 690, yearly: 6900 },
    currency: 'THB',
    limits: {
      maxDocuments: 2000,
      maxUploadMb: 200,
      maxPages: 2000,
      exportsPerMonth: Number.POSITIVE_INFINITY,
      watermark: false,
      highQualityImages: true,
      prioritySupport: true,
    },
    features: [
      'plan.team.feature.everything',
      'plan.team.feature.documents',
      'plan.team.feature.upload',
      'plan.team.feature.templates',
      'plan.team.feature.support',
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ['free', 'pro', 'team'];

export const PAID_PLANS: PlanId[] = ['pro', 'team'];

export function getPlan(planId: string | null | undefined): Plan {
  // `Object.hasOwn`, not `in`: `'__proto__' in PLANS` is true and would hand
  // back `Object.prototype`, which has no `limits` and throws at the first read.
  if (planId && Object.hasOwn(PLANS, planId)) return PLANS[planId as PlanId];
  return PLANS.free;
}

export function isPaidPlan(planId: string | null | undefined): boolean {
  return planId === 'pro' || planId === 'team';
}

/** Monthly-equivalent saving when paying yearly, as a percentage. */
export function yearlySavingPercent(plan: Plan): number {
  const monthlyTotal = plan.price.monthly * 12;
  if (monthlyTotal === 0) return 0;
  return Math.round(((monthlyTotal - plan.price.yearly) / monthlyTotal) * 100);
}
