import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AuthForm } from '@/components/auth/auth-form';
import { AuthShell } from '@/components/auth/auth-shell';
import { getTranslator } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslator())('meta.login') };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getCurrentUser()) redirect('/app');
  const t = await getTranslator();
  const { next } = await searchParams;
  // Only allow same-site redirects.
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/app';

  return (
    <AuthShell title={t('auth.login')} subtitle={t('authshell.loginSubtitle')}>
      <AuthForm mode="login" next={target} />
    </AuthShell>
  );
}
