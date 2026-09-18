import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FEATURES, planAllows } from '../src/lib/features.ts';
import {
  PAID_PLANS,
  PLANS,
  PLAN_ORDER,
  type PlanId,
  formatLimit,
  getPlan,
  isPaidPlan,
  yearlySavingPercent,
} from '../src/lib/plans.ts';

describe('the plan table', () => {
  it('lists every plan exactly once, in order', () => {
    assert.deepEqual([...PLAN_ORDER].sort(), Object.keys(PLANS).sort());
    assert.equal(new Set(PLAN_ORDER).size, PLAN_ORDER.length);
    assert.equal(PLAN_ORDER[0], 'free', 'the cheapest plan must come first');
  });

  it('keys every entry by its own id', () => {
    for (const [key, plan] of Object.entries(PLANS)) {
      assert.equal(plan.id, key);
    }
  });

  it('never gives a higher plan a smaller allowance', () => {
    const numeric = ['maxDocuments', 'maxUploadMb', 'maxPages', 'exportsPerMonth'] as const;
    for (let index = 1; index < PLAN_ORDER.length; index += 1) {
      const lower = PLANS[PLAN_ORDER[index - 1]].limits;
      const higher = PLANS[PLAN_ORDER[index]].limits;
      for (const limit of numeric) {
        assert.ok(
          higher[limit] >= lower[limit],
          `${PLAN_ORDER[index]}.${limit} (${higher[limit]}) is below ${PLAN_ORDER[index - 1]} (${lower[limit]})`,
        );
      }
      assert.ok(!higher.watermark || lower.watermark, 'a higher plan must not gain a watermark');
      assert.ok(
        higher.highQualityImages || !lower.highQualityImages,
        'a higher plan must not lose high-quality images',
      );
      assert.ok(
        higher.prioritySupport || !lower.prioritySupport,
        'a higher plan must not lose priority support',
      );
    }
  });

  it('never prices a higher plan below a lower one', () => {
    for (let index = 1; index < PLAN_ORDER.length; index += 1) {
      const lower = PLANS[PLAN_ORDER[index - 1]].price;
      const higher = PLANS[PLAN_ORDER[index]].price;
      assert.ok(higher.monthly >= lower.monthly);
      assert.ok(higher.yearly >= lower.yearly);
    }
  });

  it('makes paying yearly cheaper than paying monthly', () => {
    for (const planId of PAID_PLANS) {
      const plan = PLANS[planId];
      assert.ok(plan.price.yearly < plan.price.monthly * 12, `${planId} yearly is not a discount`);
      assert.ok(yearlySavingPercent(plan) > 0);
    }
    assert.equal(yearlySavingPercent(PLANS.free), 0, 'a free plan cannot show a saving');
  });

  it('agrees with itself about which plans cost money', () => {
    for (const planId of PLAN_ORDER) {
      assert.equal(
        isPaidPlan(planId),
        PLANS[planId].price.monthly > 0,
        `isPaidPlan disagrees with the price of ${planId}`,
      );
      assert.equal(PAID_PLANS.includes(planId), isPaidPlan(planId));
    }
  });
});

describe('getPlan', () => {
  it('returns the named plan', () => {
    assert.equal(getPlan('pro').id, 'pro');
  });

  it('falls back to free for anything it does not recognise', () => {
    for (const input of [null, undefined, '', 'enterprise', 'PRO', '__proto__', 'constructor']) {
      assert.equal(getPlan(input).id, 'free', `getPlan(${JSON.stringify(input)}) should be free`);
    }
  });
});

describe('the feature registry', () => {
  it('keys every entry by its own key', () => {
    for (const [key, feature] of Object.entries(FEATURES)) {
      assert.equal(feature.key, key);
    }
  });

  it('only requires plans that exist', () => {
    for (const feature of Object.values(FEATURES)) {
      assert.ok(PLAN_ORDER.includes(feature.plan), `${feature.key} wants unknown plan ${feature.plan}`);
    }
  });

  it('gives every entry a label and a description, since members read them', () => {
    for (const feature of Object.values(FEATURES)) {
      assert.ok(feature.label.trim().length > 0, `${feature.key} has no label`);
      assert.ok(feature.description.trim().length > 0, `${feature.key} has no description`);
    }
  });

  it('never takes a feature away on a higher plan', () => {
    for (const key of Object.keys(FEATURES)) {
      let seenAllowed = false;
      for (const planId of PLAN_ORDER) {
        const allowed = planAllows(planId, key);
        if (seenAllowed) assert.ok(allowed, `${key} is lost when upgrading to ${planId}`);
        seenAllowed ||= allowed;
      }
      assert.ok(seenAllowed, `${key} is not available on any plan`);
    }
  });

  it('refuses an unknown key rather than defaulting to allowed', () => {
    assert.equal(planAllows('team', 'no.such.feature'), false);
    assert.equal(planAllows('team', 'toString'), false, 'inherited keys are not features');
  });

  it('keeps every paid add-on out of the free plan', () => {
    for (const feature of Object.values(FEATURES)) {
      if (feature.source !== 'private') continue;
      assert.equal(planAllows('free', feature.key), false, `${feature.key} is free by accident`);
    }
  });
});

describe('features derived from plan limits', () => {
  /**
   * These are the entries that used to restate a limit. The assertions below
   * are the reason they are derived: they must agree with the plan table for
   * every plan, whatever anyone later changes in it.
   */
  const derived: [key: string, satisfied: (planId: PlanId) => boolean][] = [
    ['export.noWatermark', (planId) => !PLANS[planId].limits.watermark],
    ['export.unlimited', (planId) => !Number.isFinite(PLANS[planId].limits.exportsPerMonth)],
    ['export.highQualityImages', (planId) => PLANS[planId].limits.highQualityImages],
  ];

  for (const [key, satisfied] of derived) {
    it(`${key} matches the plan table on every plan`, () => {
      for (const planId of PLAN_ORDER) {
        assert.equal(
          planAllows(planId, key),
          satisfied(planId),
          `${key} and the ${planId} limits disagree`,
        );
      }
    });
  }
});

describe('formatLimit', () => {
  it('spells out an unlimited allowance instead of printing Infinity', () => {
    assert.equal(formatLimit(Number.POSITIVE_INFINITY), 'ไม่จำกัด');
  });

  it('groups large numbers', () => {
    assert.equal(formatLimit(2000), '2,000');
    assert.equal(formatLimit(3), '3');
  });
});
