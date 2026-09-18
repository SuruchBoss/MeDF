import type { Metadata } from 'next';
import { requireUser, toPublicUser } from '@/lib/auth';
import { ensurePlanFresh } from '@/lib/billing';
import { getUsageSummary } from '@/lib/quota';
import { AccountPanel } from '@/components/app/account-panel';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'บัญชีของฉัน' };

export default async function AccountPage() {
  const user = await ensurePlanFresh(await requireUser());
  const usage = await getUsageSummary(user);
  return <AccountPanel user={toPublicUser(user)} usage={usage} />;
}
