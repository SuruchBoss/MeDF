import path from 'node:path';

/**
 * Runtime configuration. Every value has a development-friendly default so the
 * app boots with an empty `.env`, while production still gets loud warnings for
 * anything that must be set explicitly (session secret, app URL).
 */

function firstDefined(...values: Array<string | undefined>): string | undefined {
  return values.find((value) => value != null && value.trim() !== '')?.trim();
}

export const isProduction = process.env.NODE_ENV === 'production';

/** Directory that holds `db.json` plus the `storage/` tree. */
export const DATA_DIR =
  firstDefined(process.env.MEDF_DATA_DIR) ?? path.join(process.cwd(), '.medf-data');

export const APP_URL =
  firstDefined(process.env.MEDF_APP_URL, process.env.NEXT_PUBLIC_MEDF_APP_URL) ??
  'http://localhost:4173';

const DEV_SESSION_SECRET = 'medf-development-secret-do-not-use-in-production';

export const SESSION_SECRET = firstDefined(process.env.MEDF_SESSION_SECRET) ?? DEV_SESSION_SECRET;

export const SESSION_COOKIE = 'medf_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const stripeConfig = {
  secretKey: firstDefined(process.env.STRIPE_SECRET_KEY),
  webhookSecret: firstDefined(process.env.STRIPE_WEBHOOK_SECRET),
  prices: {
    pro: {
      monthly: firstDefined(process.env.STRIPE_PRICE_PRO_MONTHLY),
      yearly: firstDefined(process.env.STRIPE_PRICE_PRO_YEARLY),
    },
    team: {
      monthly: firstDefined(process.env.STRIPE_PRICE_TEAM_MONTHLY),
      yearly: firstDefined(process.env.STRIPE_PRICE_TEAM_YEARLY),
    },
  },
} as const;

export const stripeEnabled = Boolean(stripeConfig.secretKey);

/**
 * The sandbox lets a member switch plans without a payment provider. It is on
 * by default whenever Stripe is not configured (local dev, desktop build) and
 * can be forced off with `MEDF_BILLING_SANDBOX=0`.
 */
export const billingSandboxEnabled = (() => {
  const raw = firstDefined(process.env.MEDF_BILLING_SANDBOX);
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return !stripeEnabled;
})();

export const adminEmail = firstDefined(process.env.MEDF_ADMIN_EMAIL)?.toLowerCase();

if (isProduction && SESSION_SECRET === DEV_SESSION_SECRET) {
  console.warn(
    '[medf] MEDF_SESSION_SECRET is not set — sessions are signed with the public development key. Set it before exposing this server.',
  );
}
