import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AuthForm } from '@/components/auth/auth-form';
import { AuthShell } from '@/components/auth/auth-shell';
import { getTranslator } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslator())('meta.register') };
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; interval?: string }>;
}) {
  if (await getCurrentUser()) redirect('/app');
  const t = await getTranslator();

  const { plan, interval } = await searchParams;
  // Carry a plan chosen on the pricing page through to checkout.
  const next =
    plan === 'pro' || plan === 'team'
      ? `/app/billing?plan=${plan}&interval=${interval === 'yearly' ? 'yearly' : 'monthly'}`
      : '/app';

  return (
    <AuthShell
      title={t('authshell.registerTitle')}
      subtitle={t('authshell.registerSubtitle')}
    >
      <AuthForm mode="register" next={next} />
    </AuthShell>
  );
}
