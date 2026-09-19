/**
 * Plan catalogue. Shared by the marketing pages and the editor, so pricing
 * only ever lives in one place.
 *
 * The copy is message keys, not text: the same table drives both languages,
 * and the compiler rejects a key that has no translation.
 *
 * Two plans, not three. The line that decides them is **editing the text
 * already in the PDF** — the one thing a pirated Acrobat cannot do well in
 * Thai, and the only thing here that costs real money to build. Counting
 * documents or exports would need a server to count them on, and there is
 * none; see docs/PRODUCT_DIRECTION.md §5.
 */

import type { MessageKey } from './i18n';

export type PlanId = 'free' | 'paid';
export type PlanStatus = 'active' | 'expired';

export interface PlanLimits {
  /** Largest PDF the editor will open, in megabytes. */
  maxUploadMb: number;
  /** Largest page count per document. */
  maxPages: number;
  /** Free exports carry a small MeDF footer. */
  watermark: boolean;
  /** Export images at full resolution rather than downsampled. */
  highQualityImages: boolean;
  /** Edit the text already in the document, rather than covering it over. */
  editOriginalText: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: MessageKey;
  /**
   * Bought once, in baht. `renewal` buys another year of updates and is
   * optional: the version bought keeps working either way.
   *
   * Both numbers are assumptions until the first ten customers say otherwise
   * (PRODUCT_DIRECTION.md §5 marks them as unconfirmed).
   */
  price: { licence: number; renewal: number };
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
    price: { licence: 0, renewal: 0 },
    currency: 'THB',
    limits: {
      maxUploadMb: 10,
      maxPages: 20,
      watermark: true,
      highQualityImages: false,
      editOriginalText: false,
    },
    features: [
      'plan.free.feature.tools',
      'plan.free.feature.upload',
      'plan.free.feature.classify',
      'plan.free.feature.watermark',
    ],
  },
  paid: {
    id: 'paid',
    name: 'MeDF',
    tagline: 'plan.paid.tagline',
    price: { licence: 1490, renewal: 690 },
    currency: 'THB',
    limits: {
      maxUploadMb: 200,
      maxPages: 2000,
      watermark: false,
      highQualityImages: true,
      editOriginalText: true,
    },
    features: [
      'plan.paid.feature.editText',
      'plan.paid.feature.noWatermark',
      'plan.paid.feature.upload',
      'plan.paid.feature.images',
      'plan.paid.feature.forever',
    ],
    highlight: true,
  },
};

export const PLAN_ORDER: PlanId[] = ['free', 'paid'];

export function getPlan(planId: string | null | undefined): Plan {
  // `Object.hasOwn`, not `in`: `'__proto__' in PLANS` is true and would hand
  // back `Object.prototype`, which has no `limits` and throws at the first read.
  if (planId && Object.hasOwn(PLANS, planId)) return PLANS[planId as PlanId];
  return PLANS.free;
}

export function isPaidPlan(planId: string | null | undefined): boolean {
  return planId === 'paid';
}
