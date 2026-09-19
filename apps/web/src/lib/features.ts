/**
 * Feature registry: every capability MeDF has, declared once, with the lowest
 * plan entitled to it.
 *
 * It used to carry a `source` saying whether the code was in this repository
 * or in a private module loaded at runtime. That machinery is gone — the paid
 * module is now an ordinary dependency that is simply not published — so a
 * feature either exists here or is not listed. Nothing below is aspirational;
 * see docs/OPEN_CORE.md.
 */

import type { MessageKey } from './i18n';
import { type PlanId, type PlanLimits, PLANS, PLAN_ORDER } from './plans';

/**
 * The lowest plan whose limits already satisfy `predicate`.
 *
 * Some entries below are a plan limit wearing a feature's name. Those derive
 * their tier from the plan table instead of restating it, so lifting a limit
 * (a free-tier promotion, say) cannot leave this registry still telling members
 * to upgrade for something the server now grants them.
 */
function lowestPlanWhere(predicate: (limits: PlanLimits) => boolean): PlanId {
  return PLAN_ORDER.find((plan) => predicate(PLANS[plan].limits)) ?? PLAN_ORDER[PLAN_ORDER.length - 1];
}

export interface FeatureDefinition {
  key: string;
  /** Message keys: a member reads these, so they follow their language. */
  label: MessageKey;
  description: MessageKey;
  plan: PlanId;
}

export const FEATURES: Record<string, FeatureDefinition> = {
  'editor.elements': {
    key: 'editor.elements',
    label: 'feature.editorElements.label',
    description: 'feature.editorElements.description',
    plan: 'free',
  },
  'editor.pages': {
    key: 'editor.pages',
    label: 'feature.editorPages.label',
    description: 'feature.editorPages.description',
    plan: 'free',
  },
  'export.pdf': {
    key: 'export.pdf',
    label: 'feature.exportPdf.label',
    description: 'feature.exportPdf.description',
    plan: 'free',
  },

  // Gated by plan. Each derives its tier from the plan table rather than
  // restating it, so lifting a limit cannot leave this registry still telling
  // members to upgrade for something they already have.
  'export.noWatermark': {
    key: 'export.noWatermark',
    label: 'feature.noWatermark.label',
    description: 'feature.noWatermark.description',
    plan: lowestPlanWhere((limits) => !limits.watermark),
  },
  'export.highQualityImages': {
    key: 'export.highQualityImages',
    label: 'feature.hqImages.label',
    description: 'feature.hqImages.description',
    plan: lowestPlanWhere((limits) => limits.highQualityImages),
  },
  'editor.originalText': {
    key: 'editor.originalText',
    label: 'feature.editText.label',
    description: 'feature.editText.description',
    plan: lowestPlanWhere((limits) => limits.editOriginalText),
  },
};

export type FeatureKey = keyof typeof FEATURES | string;

/**
 * True when `plan` is at least as high as the feature requires.
 *
 * This is an entitlement check, so every unknown answers no. `Object.hasOwn`
 * rather than a bare lookup because `FEATURES['toString']` finds
 * `Object.prototype.toString` — an object truthy enough to pass a `!feature`
 * guard, with an undefined `plan` that `indexOf` ranks at -1, which every real
 * plan then outranks. That is an authorisation check answering yes to a name
 * nobody declared.
 */
export function planAllows(plan: PlanId, key: FeatureKey): boolean {
  if (!Object.hasOwn(FEATURES, key)) return false;
  const required = PLAN_ORDER.indexOf(FEATURES[key].plan);
  const held = PLAN_ORDER.indexOf(plan);
  if (required === -1 || held === -1) return false;
  return held >= required;
}

/** Shape the UI reads to decide whether to show an entry point. */
export interface FeatureAvailability {
  key: string;
  label: MessageKey;
  description: MessageKey;
  plan: PlanId;
  available: boolean;
}

/** What this licence can reach, for a screen that lists the whole catalogue. */
export function featuresFor(plan: PlanId): FeatureAvailability[] {
  return Object.values(FEATURES).map((feature) => ({
    key: feature.key,
    label: feature.label,
    description: feature.description,
    plan: feature.plan,
    available: planAllows(plan, feature.key),
  }));
}
