import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LOGIN_POLICY, createMemoryRateLimiter, type RateLimitPolicy } from '../src/lib/rate-limit.ts';

/**
 * The clock is injected, so the window and the block are checked for real
 * rather than approximated with a short policy and a sleep.
 */
const POLICY: RateLimitPolicy = { windowMs: 60_000, maxAttempts: 3, blockMs: 120_000 };

function limiterAt(start = 1_000_000) {
  let now = start;
  return {
    limiter: createMemoryRateLimiter(POLICY, () => now),
    advance(ms: number) {
      now += ms;
    },
  };
}

async function fail(limiter: { recordFailure(key: string): Promise<void> }, key: string, times: number) {
  for (let i = 0; i < times; i += 1) await limiter.recordFailure(key);
}

describe('createMemoryRateLimiter', () => {
  it('allows a key that has never failed', async () => {
    const { limiter } = limiterAt();
    assert.deepEqual(await limiter.check('someone'), { blocked: false, retryInMinutes: 0 });
  });

  it('allows a key that is still under the limit', async () => {
    const { limiter } = limiterAt();
    await fail(limiter, 'someone', POLICY.maxAttempts - 1);
    assert.equal((await limiter.check('someone')).blocked, false);
  });

  it('blocks on the attempt that reaches the limit', async () => {
    const { limiter } = limiterAt();
    await fail(limiter, 'someone', POLICY.maxAttempts);

    const verdict = await limiter.check('someone');
    assert.equal(verdict.blocked, true);
    assert.equal(verdict.retryInMinutes, 2, 'a two-minute block must be reported as two minutes');
  });

  it('rounds the wait up, so it never reports zero minutes left', async () => {
    const { limiter, advance } = limiterAt();
    await fail(limiter, 'someone', POLICY.maxAttempts);
    advance(POLICY.blockMs - 1);

    const verdict = await limiter.check('someone');
    assert.equal(verdict.blocked, true);
    assert.equal(verdict.retryInMinutes, 1);
  });

  it('lets the key back in once the block has run out', async () => {
    const { limiter, advance } = limiterAt();
    await fail(limiter, 'someone', POLICY.maxAttempts);
    advance(POLICY.blockMs + 1);

    assert.equal((await limiter.check('someone')).blocked, false);
  });

  it('does not count failures from before the window', async () => {
    const { limiter, advance } = limiterAt();
    await fail(limiter, 'someone', POLICY.maxAttempts - 1);
    advance(POLICY.windowMs + 1);

    // The one that would have been the third is now the first of a new window.
    await limiter.recordFailure('someone');
    assert.equal((await limiter.check('someone')).blocked, false);
  });

  it('forgets a key that succeeds', async () => {
    const { limiter } = limiterAt();
    await fail(limiter, 'someone', POLICY.maxAttempts);
    await limiter.clear('someone');

    assert.equal((await limiter.check('someone')).blocked, false);
  });

  it('keeps keys apart, so one member cannot lock another out', async () => {
    const { limiter } = limiterAt();
    await fail(limiter, 'noisy', POLICY.maxAttempts);

    assert.equal((await limiter.check('noisy')).blocked, true);
    assert.equal((await limiter.check('quiet')).blocked, false);
  });
});

describe('LOGIN_POLICY', () => {
  it('is strict enough to matter and loose enough to survive a typo', () => {
    assert.ok(LOGIN_POLICY.maxAttempts >= 5, 'fewer than five locks out honest members');
    assert.ok(LOGIN_POLICY.maxAttempts <= 10, 'more than ten is not much of a limit');
    assert.ok(LOGIN_POLICY.blockMs >= 5 * 60_000, 'a block shorter than five minutes costs nothing');
    assert.ok(LOGIN_POLICY.windowMs >= LOGIN_POLICY.blockMs, 'the window must outlast the block');
  });
});
