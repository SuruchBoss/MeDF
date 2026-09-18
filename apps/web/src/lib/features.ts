/**
 * Feature registry — the boundary between the open-source core and the paid
 * add-ons.
 *
 * Every capability in MeDF is declared here exactly once, with two orthogonal
 * properties:
 *
 *   `plan`   — the lowest plan entitled to it.
 *   `source` — where its code lives:
 *                'core'    the implementation is in this repository (open
 *                          source); the plan only gates *access*.
 *                'private' the implementation is NOT in this repository. It
 *                          ships as a separate private module that is loaded
 *                          at runtime; without that module the feature simply
 *                          does not exist.
 *
 * Declaring a feature here is deliberate: the *name* of a paid feature is
 * public (members need to know what they are buying), its *code* need not be.
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

export type FeatureSource = 'core' | 'private';

export interface FeatureDefinition {
  key: string;
  /** Message keys: a member reads these, so they follow their language. */
  label: MessageKey;
  description: MessageKey;
  plan: PlanId;
  source: FeatureSource;
}

export const FEATURES: Record<string, FeatureDefinition> = {
  // --- Core: open source, available to everyone ---------------------------
  'editor.elements': {
    key: 'editor.elements',
    label: 'feature.editorElements.label',
    description: 'feature.editorElements.description',
    plan: 'free',
    source: 'core',
  },
  'editor.pages': {
    key: 'editor.pages',
    label: 'feature.editorPages.label',
    description: 'feature.editorPages.description',
    plan: 'free',
    source: 'core',
  },
  'export.pdf': {
    key: 'export.pdf',
    label: 'feature.exportPdf.label',
    description: 'feature.exportPdf.description',
    plan: 'free',
    source: 'core',
  },

  // --- Core: open source, but gated by plan ------------------------------
  'export.noWatermark': {
    key: 'export.noWatermark',
    label: 'feature.noWatermark.label',
    description: 'feature.noWatermark.description',
    plan: lowestPlanWhere((limits) => !limits.watermark),
    source: 'core',
  },
  'export.unlimited': {
    key: 'export.unlimited',
    label: 'feature.unlimited.label',
    description: 'feature.unlimited.description',
    plan: lowestPlanWhere((limits) => !Number.isFinite(limits.exportsPerMonth)),
    source: 'core',
  },
  'export.highQualityImages': {
    key: 'export.highQualityImages',
    label: 'feature.hqImages.label',
    description: 'feature.hqImages.description',
    plan: lowestPlanWhere((limits) => limits.highQualityImages),
    source: 'core',
  },

  // --- Paid add-ons: implementation lives outside this repository ---------
  // The keys below are the contract the private module implements. When the
  // module is not installed these features are reported as unavailable, and
  // nothing in this repository reveals how they work.
  'pro.ocr': {
    key: 'pro.ocr',
    label: 'feature.ocr.label',
    description: 'feature.ocr.description',
    plan: 'pro',
    source: 'private',
  },
  'pro.redact': {
    key: 'pro.redact',
    label: 'feature.redact.label',
    description: 'feature.redact.description',
    plan: 'pro',
    source: 'private',
  },
  'pro.templates': {
    key: 'pro.templates',
    label: 'feature.templates.label',
    description: 'feature.templates.description',
    plan: 'team',
    source: 'private',
  },
  'pro.batch': {
    key: 'pro.batch',
    label: 'feature.batch.label',
    description: 'feature.batch.description',
    plan: 'team',
    source: 'private',
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

/** Shape returned to the browser so the UI can show or hide entry points. */
export interface FeatureAvailability {
  key: string;
  label: MessageKey;
  description: MessageKey;
  plan: PlanId;
  source: FeatureSource;
  /** Entitled by plan *and* actually installed on this server. */
  available: boolean;
  /** Present for paid add-ons that this installation does not have. */
  reason?: 'plan' | 'not_installed';
}
