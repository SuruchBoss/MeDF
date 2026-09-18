import type { Metadata } from 'next';
import { requireUser, toPublicUser } from '@/lib/auth';
import { billingMode, ensurePlanFresh, listInvoices } from '@/lib/billing';
import { featureAvailability } from '@/lib/pro';
import type { BillingInterval, PlanId } from '@/lib/plans';
import { BillingPanel } from '@/components/app/billing-panel';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'การสมัครสมาชิก' };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; interval?: string; status?: string }>;
}) {
  const user = await ensurePlanFresh(await requireUser());
  const invoices = await listInvoices(user.id);
  const { plan, interval } = await searchParams;

  const preselect =
    plan === 'pro' || plan === 'team'
      ? {
          plan: plan as PlanId,
          interval: (interval === 'yearly' ? 'yearly' : 'monthly') as BillingInterval,
        }
      : null;

  return (
    <BillingPanel
      user={toPublicUser(user)}
      invoices={invoices}
      mode={billingMode()}
      preselect={preselect}
      features={featureAvailability(user)}
    />
  );
}
