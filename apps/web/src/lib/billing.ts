import 'server-only';
import {
  type InvoiceRecord,
  type UserRecord,
  mutate,
  newId,
  nowIso,
  readDb,
} from './db';
import { APP_URL, billingSandboxEnabled, stripeConfig, stripeEnabled } from './env';
import { BillingError } from './errors';
import {
  type BillingInterval,
  type PlanId,
  PAID_PLANS,
  getPlan,
  isPaidPlan,
} from './plans';

/**
 * Subscription management.
 *
 * Two providers are supported and the rest of the app does not care which is
 * active: real Stripe Checkout when `STRIPE_SECRET_KEY` is configured, and a
 * built-in sandbox (no card, activates immediately) otherwise. The sandbox is
 * what the desktop build and local development use.
 */

export interface CheckoutResult {
  provider: 'stripe' | 'sandbox';
  /** Where the browser should go next. */
  url: string;
}

function periodEnd(interval: BillingInterval, from: Date = new Date()): string {
  const end = new Date(from);
  if (interval === 'yearly') end.setUTCFullYear(end.getUTCFullYear() + 1);
  else end.setUTCMonth(end.getUTCMonth() + 1);
  return end.toISOString();
}

export function assertPaidPlan(planId: string): PlanId {
  if (!PAID_PLANS.includes(planId as PlanId)) {
    throw new BillingError('billing.error.pickPaidPlan');
  }
  return planId as PlanId;
}

/** Applies a successful payment to a member. */
export async function activatePlan(options: {
  userId: string;
  plan: PlanId;
  interval: BillingInterval;
  provider: 'stripe' | 'sandbox';
  reference?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: string | null;
}): Promise<UserRecord> {
  const plan = getPlan(options.plan);
  const amount = plan.price[options.interval];

  return mutate((db) => {
    const user = db.users.find((candidate) => candidate.id === options.userId);
    if (!user) throw new BillingError('billing.error.noUser', { status: 404 });

    user.plan = options.plan;
    user.planStatus = 'active';
    user.planInterval = options.interval;
    user.currentPeriodEnd = options.currentPeriodEnd ?? periodEnd(options.interval);
    user.cancelAtPeriodEnd = false;
    if (options.stripeCustomerId) user.stripeCustomerId = options.stripeCustomerId;
    if (options.stripeSubscriptionId) user.stripeSubscriptionId = options.stripeSubscriptionId;

    const invoice: InvoiceRecord = {
      id: newId('inv'),
      userId: user.id,
      plan: options.plan,
      interval: options.interval,
      amount,
      currency: 'THB',
      status: 'paid',
      provider: options.provider,
      reference: options.reference ?? null,
      createdAt: nowIso(),
    };
    db.invoices.push(invoice);

    return user;
  });
}

export async function startCheckout(options: {
  user: UserRecord;
  plan: PlanId;
  interval: BillingInterval;
}): Promise<CheckoutResult> {
  const { user, interval } = options;
  const plan = assertPaidPlan(options.plan);

  if (stripeEnabled) {
    const priceId = stripeConfig.prices[plan as 'pro' | 'team']?.[interval];
    if (!priceId) {
      throw new BillingError('billing.error.stripeNoPrice', {
        status: 500,
        params: { plan, interval },
      });
    }
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(stripeConfig.secretKey!);

    const customerId =
      user.stripeCustomerId ??
      (
        await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: { medfUserId: user.id },
        })
      ).id;

    if (!user.stripeCustomerId) {
      await mutate((db) => {
        const target = db.users.find((candidate) => candidate.id === user.id);
        if (target) target.stripeCustomerId = customerId;
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${APP_URL}/app/billing?status=success`,
      cancel_url: `${APP_URL}/app/billing?status=cancelled`,
      client_reference_id: user.id,
      metadata: { medfUserId: user.id, plan, interval },
      subscription_data: { metadata: { medfUserId: user.id, plan, interval } },
    });

    if (!session.url) throw new BillingError('billing.error.stripeNoUrl', { status: 502 });
    return { provider: 'stripe', url: session.url };
  }

  if (!billingSandboxEnabled) {
    throw new BillingError('billing.error.notConfigured', { status: 503 });
  }

  await activatePlan({
    userId: user.id,
    plan,
    interval,
    provider: 'sandbox',
    reference: `sandbox_${Date.now()}`,
  });
  return { provider: 'sandbox', url: `/app/billing?status=activated&plan=${plan}` };
}

export async function cancelSubscription(user: UserRecord): Promise<UserRecord> {
  if (!isPaidPlan(user.plan)) {
    throw new BillingError('billing.error.alreadyFree');
  }

  if (stripeEnabled && user.stripeSubscriptionId) {
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(stripeConfig.secretKey!);
    await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: true });
  }

  return mutate((db) => {
    const target = db.users.find((candidate) => candidate.id === user.id);
    if (!target) throw new BillingError('billing.error.noUser', { status: 404 });
    target.cancelAtPeriodEnd = true;
    target.planStatus = 'canceled';
    // The paid period is honoured until it runs out.
    target.currentPeriodEnd ??= nowIso();
    return target;
  });
}

export async function resumeSubscription(user: UserRecord): Promise<UserRecord> {
  if (!isPaidPlan(user.plan) || !user.cancelAtPeriodEnd) {
    throw new BillingError('billing.error.noCancellation');
  }

  if (stripeEnabled && user.stripeSubscriptionId) {
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(stripeConfig.secretKey!);
    await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: false });
  }

  return mutate((db) => {
    const target = db.users.find((candidate) => candidate.id === user.id);
    if (!target) throw new BillingError('billing.error.noUser', { status: 404 });
    target.cancelAtPeriodEnd = false;
    target.planStatus = 'active';
    return target;
  });
}

/**
 * Drops a member back to the free plan once a cancelled or unpaid period has
 * elapsed. Called on every authenticated request, which keeps plan state
 * correct without a background scheduler.
 */
export async function ensurePlanFresh(user: UserRecord): Promise<UserRecord> {
  if (!isPaidPlan(user.plan)) return user;
  if (!user.currentPeriodEnd) return user;
  if (new Date(user.currentPeriodEnd).getTime() > Date.now()) return user;
  if (!user.cancelAtPeriodEnd && user.planStatus === 'active' && stripeEnabled) {
    // Stripe renews on its own; the webhook moves the period forward.
    return user;
  }

  return mutate((db) => {
    const target = db.users.find((candidate) => candidate.id === user.id);
    if (!target) return user;
    target.plan = 'free';
    target.planStatus = 'active';
    target.planInterval = null;
    target.currentPeriodEnd = null;
    target.cancelAtPeriodEnd = false;
    target.stripeSubscriptionId = null;
    return target;
  });
}

export async function listInvoices(userId: string): Promise<InvoiceRecord[]> {
  const db = await readDb();
  return db.invoices
    .filter((invoice) => invoice.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function billingMode(): 'stripe' | 'sandbox' | 'disabled' {
  if (stripeEnabled) return 'stripe';
  return billingSandboxEnabled ? 'sandbox' : 'disabled';
}
