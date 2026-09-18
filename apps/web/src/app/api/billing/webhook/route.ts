import type Stripe from 'stripe';
import { mutate, readDb } from '@/lib/db';
import { stripeConfig, stripeEnabled } from '@/lib/env';
import { activatePlan } from '@/lib/billing';
import type { BillingInterval, PlanId } from '@/lib/plans';
import { jsonError, jsonOk } from '@/lib/api';

/**
 * Stripe webhook. Keeps plan state in sync with the real source of truth:
 * renewals move the period forward, failed payments mark the member past due,
 * and a deleted subscription drops them back to the free plan.
 */

export const dynamic = 'force-dynamic';

function planFromMetadata(metadata: Stripe.Metadata | null | undefined): {
  plan: PlanId;
  interval: BillingInterval;
} | null {
  const plan = metadata?.plan;
  const interval = metadata?.interval;
  if ((plan === 'pro' || plan === 'team') && (interval === 'monthly' || interval === 'yearly')) {
    return { plan, interval };
  }
  return null;
}

async function findUserId(options: {
  metadataUserId?: string | null;
  customerId?: string | null;
}): Promise<string | null> {
  if (options.metadataUserId) return options.metadataUserId;
  if (!options.customerId) return null;
  const db = await readDb();
  return db.users.find((user) => user.stripeCustomerId === options.customerId)?.id ?? null;
}

export async function POST(request: Request) {
  if (!stripeEnabled) return jsonError('Stripe is not enabled', 503);
  if (!stripeConfig.webhookSecret) return jsonError('STRIPE_WEBHOOK_SECRET is not configured', 500);

  const signature = request.headers.get('stripe-signature');
  if (!signature) return jsonError('Missing stripe-signature header', 400);

  const payload = await request.text();
  const { default: StripeClient } = await import('stripe');
  const stripe = new StripeClient(stripeConfig.secretKey!);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      stripeConfig.webhookSecret,
    );
  } catch (error) {
    return jsonError(`Webhook signature check failed: ${(error as Error).message}`, 400);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const details = planFromMetadata(session.metadata);
      const userId = await findUserId({
        metadataUserId: session.metadata?.medfUserId ?? session.client_reference_id,
        customerId: typeof session.customer === 'string' ? session.customer : null,
      });
      if (userId && details) {
        await activatePlan({
          userId,
          plan: details.plan,
          interval: details.interval,
          provider: 'stripe',
          reference: session.id,
          stripeCustomerId: typeof session.customer === 'string' ? session.customer : null,
          stripeSubscriptionId:
            typeof session.subscription === 'string' ? session.subscription : null,
        });
      }
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const subscription = event.data.object;
      const details = planFromMetadata(subscription.metadata);
      const userId = await findUserId({
        metadataUserId: subscription.metadata?.medfUserId,
        customerId: typeof subscription.customer === 'string' ? subscription.customer : null,
      });
      if (!userId) break;

      const periodEnd = subscription.items.data[0]?.current_period_end;
      await mutate((db) => {
        const user = db.users.find((candidate) => candidate.id === userId);
        if (!user) return;
        if (details) {
          user.plan = details.plan;
          user.planInterval = details.interval;
        }
        user.stripeSubscriptionId = subscription.id;
        user.cancelAtPeriodEnd = subscription.cancel_at_period_end;
        user.currentPeriodEnd = periodEnd
          ? new Date(periodEnd * 1000).toISOString()
          : user.currentPeriodEnd;
        user.planStatus =
          subscription.status === 'active' || subscription.status === 'trialing'
            ? subscription.cancel_at_period_end
              ? 'canceled'
              : 'active'
            : subscription.status === 'past_due' || subscription.status === 'unpaid'
              ? 'past_due'
              : 'canceled';
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const userId = await findUserId({
        metadataUserId: subscription.metadata?.medfUserId,
        customerId: typeof subscription.customer === 'string' ? subscription.customer : null,
      });
      if (!userId) break;
      await mutate((db) => {
        const user = db.users.find((candidate) => candidate.id === userId);
        if (!user) return;
        user.plan = 'free';
        user.planStatus = 'active';
        user.planInterval = null;
        user.currentPeriodEnd = null;
        user.cancelAtPeriodEnd = false;
        user.stripeSubscriptionId = null;
      });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      const userId = await findUserId({
        customerId: typeof invoice.customer === 'string' ? invoice.customer : null,
      });
      if (!userId) break;
      await mutate((db) => {
        const user = db.users.find((candidate) => candidate.id === userId);
        if (user) user.planStatus = 'past_due';
      });
      break;
    }

    default:
      // Unhandled event types are acknowledged so Stripe stops retrying.
      break;
  }

  return jsonOk({ received: true });
}
