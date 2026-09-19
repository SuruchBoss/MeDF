import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FEATURES, planAllows } from '../src/lib/features.ts';
import { formatCount, formatMoney } from '../src/lib/i18n/format.ts';
import { PLANS, PLAN_ORDER, type PlanId, getPlan, isPaidPlan } from '../src/lib/plans.ts';

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
    const numeric = ['maxUploadMb', 'maxPages'] as const;
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
        higher.editOriginalText || !lower.editOriginalText,
        'a higher plan must not lose original-text editing',
      );
    }
  });

  it('never prices a higher plan below a lower one', () => {
    for (let index = 1; index < PLAN_ORDER.length; index += 1) {
      const lower = PLANS[PLAN_ORDER[index - 1]].price;
      const higher = PLANS[PLAN_ORDER[index]].price;
      assert.ok(higher.licence >= lower.licence);
      assert.ok(higher.renewal >= lower.renewal);
    }
  });

  it('never charges more to renew than to buy', () => {
    // The renewal buys updates, not access. Pricing it above the licence
    // would make it a subscription wearing a licence's name.
    for (const planId of PLAN_ORDER) {
      const { licence, renewal } = PLANS[planId].price;
      assert.ok(renewal <= licence, `${planId}: renewal ${renewal} exceeds licence ${licence}`);
    }
  });

  it('gives every plan a tagline key and at least three feature keys', () => {
    for (const planId of PLAN_ORDER) {
      const plan = PLANS[planId];
      assert.ok(plan.tagline.startsWith('plan.'), `${planId} tagline is not a message key`);
      assert.ok(plan.features.length >= 3, `${planId} lists too few features`);
      for (const feature of plan.features) {
        assert.ok(feature.startsWith('plan.'), `${planId}: ${feature} is not a message key`);
      }
    }
  });

  it('agrees with itself about which plans cost money', () => {
    for (const planId of PLAN_ORDER) {
      assert.equal(
        isPaidPlan(planId),
        PLANS[planId].price.licence > 0,
        `isPaidPlan disagrees with the price of ${planId}`,
      );
    }
  });
});

describe('getPlan', () => {
  it('returns the named plan', () => {
    assert.equal(getPlan('paid').id, 'paid');
  });

  it('falls back to free for anything it does not recognise', () => {
    for (const input of [null, undefined, '', 'enterprise', 'PAID', '__proto__', 'constructor']) {
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
    assert.equal(planAllows('paid', 'no.such.feature'), false);
    assert.equal(planAllows('paid', 'toString'), false, 'inherited keys are not features');
    assert.equal(planAllows('paid', '__proto__'), false, 'nor is the prototype itself');
  });

  it('keeps editing the original text behind the paid plan', () => {
    // This is the line the whole price rests on; a stray edit that makes it
    // free gives the product away.
    assert.equal(planAllows('free', 'editor.originalText'), false);
    assert.equal(planAllows('paid', 'editor.originalText'), true);
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
    ['export.highQualityImages', (planId) => PLANS[planId].limits.highQualityImages],
    ['editor.originalText', (planId) => PLANS[planId].limits.editOriginalText],
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

describe('formatCount', () => {
  it('returns null for an unlimited allowance rather than printing Infinity', () => {
    // `null` keeps this a pure formatter: the caller supplies the word, in
    // whichever language it is already holding a translator for.
    assert.equal(formatCount(Number.POSITIVE_INFINITY, 'th'), null);
    assert.equal(formatCount(Number.POSITIVE_INFINITY, 'en'), null);
  });

  it('groups large numbers in both locales', () => {
    assert.equal(formatCount(2000, 'th'), '2,000');
    assert.equal(formatCount(2000, 'en'), '2,000');
    assert.equal(formatCount(3, 'en'), '3');
  });
});

describe('formatMoney', () => {
  it('renders the same amount the way each language expects', () => {
    for (const locale of ['th', 'en'] as const) {
      const rendered = formatMoney(249, locale);
      assert.ok(rendered.includes('249'), `${locale}: ${rendered}`);
      // Currency, not a bare number — a price without its unit is a bug.
      assert.ok(/[฿]|THB/.test(rendered), `${locale}: ${rendered} has no currency`);
    }
  });

  it('does not show fractional baht', () => {
    assert.ok(!formatMoney(2490, 'en').includes('.00'));
  });
});
