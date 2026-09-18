import 'server-only';

/**
 * Throttling for things that must not be guessable by repetition — today that
 * is the login form, which is the one endpoint where an attacker gets to try
 * again as often as we let them.
 *
 * The counters are behind an interface because *where* they live is a
 * deployment decision, not an application one. One process on one machine is
 * the shape MeDF ships in, and a `Map` is the right answer for it: no
 * dependency, no setup, and a restart clearing the counters is a fair trade.
 * The moment there is a second process the answer changes — two servers each
 * allowing eight attempts allow sixteen — and then `setLoginRateLimiter` takes
 * an implementation backed by something shared. Nothing above this line has to
 * change for that; see docs/ARCHITECTURE.md.
 */

export interface RateLimitVerdict {
  /** True when the caller should be turned away without checking anything. */
  blocked: boolean;
  /** Whole minutes until the block lifts. `0` when not blocked. */
  retryInMinutes: number;
}

export interface RateLimiter {
  /** Asks whether `key` may try now. Does not count the attempt. */
  check(key: string): Promise<RateLimitVerdict>;
  /** Counts one failed attempt, blocking `key` once it has had too many. */
  recordFailure(key: string): Promise<void>;
  /** Forgets `key`, called after a success. */
  clear(key: string): Promise<void>;
}

export interface RateLimitPolicy {
  /** Failures older than this no longer count towards the total. */
  windowMs: number;
  /** Failures inside the window before the key is blocked. */
  maxAttempts: number;
  /** How long a block lasts. */
  blockMs: number;
}

export const LOGIN_POLICY: RateLimitPolicy = {
  windowMs: 15 * 60 * 1000,
  maxAttempts: 8,
  blockMs: 10 * 60 * 1000,
};

const ALLOWED: RateLimitVerdict = { blocked: false, retryInMinutes: 0 };

interface Attempt {
  count: number;
  firstAt: number;
  blockedUntil: number;
}

/**
 * The single-process implementation.
 *
 * `now` is injectable so the window and the block can be tested without a test
 * that sleeps for fifteen minutes.
 */
export function createMemoryRateLimiter(
  policy: RateLimitPolicy,
  now: () => number = Date.now,
): RateLimiter {
  const attempts = new Map<string, Attempt>();

  return {
    async check(key) {
      const entry = attempts.get(key);
      if (!entry) return ALLOWED;

      const at = now();
      if (entry.blockedUntil > at) {
        return { blocked: true, retryInMinutes: Math.ceil((entry.blockedUntil - at) / 60000) };
      }
      // Nothing recent enough to hold against this key any more.
      if (at - entry.firstAt > policy.windowMs) attempts.delete(key);
      return ALLOWED;
    },

    async recordFailure(key) {
      const at = now();
      const entry = attempts.get(key);
      if (!entry || at - entry.firstAt > policy.windowMs) {
        attempts.set(key, { count: 1, firstAt: at, blockedUntil: 0 });
        return;
      }

      entry.count += 1;
      if (entry.count >= policy.maxAttempts) {
        // Start the next window clean, so serving the block does not also
        // carry the old failures into the period after it.
        entry.blockedUntil = at + policy.blockMs;
        entry.count = 0;
        entry.firstAt = at;
      }
    },

    async clear(key) {
      attempts.delete(key);
    },
  };
}

// Survive hot reloads in development, or every edit would forgive an attacker.
const limiterState = globalThis as typeof globalThis & { __medfLoginLimiter?: RateLimiter };

export function loginRateLimiter(): RateLimiter {
  return (limiterState.__medfLoginLimiter ??= createMemoryRateLimiter(LOGIN_POLICY));
}

/**
 * Swaps the login limiter, for a deployment that runs more than one process.
 * Call it once at start-up, before the first request.
 */
export function setLoginRateLimiter(limiter: RateLimiter): void {
  limiterState.__medfLoginLimiter = limiter;
}
