import type { Metadata } from 'next';
import { requireUser, toPublicUser } from '@/lib/auth';
import { ensurePlanFresh } from '@/lib/billing';
import { getUsageSummary } from '@/lib/quota';
import { AccountPanel } from '@/components/app/account-panel';
import { getTranslator } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslator())('meta.account') };
}

export default async function AccountPage() {
  const user = await ensurePlanFresh(await requireUser());
  const usage = await getUsageSummary(user);
  return <AccountPanel user={toPublicUser(user)} usage={usage} />;
}
