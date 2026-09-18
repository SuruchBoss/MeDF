import { redirect } from 'next/navigation';
import { getCurrentUser, toPublicUser } from '@/lib/auth';
import { ensurePlanFresh } from '@/lib/billing';
import { AppNav } from '@/components/app/app-nav';

export const dynamic = 'force-dynamic';

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const current = await getCurrentUser();
  if (!current) redirect('/login?next=/app');
  const user = await ensurePlanFresh(current);

  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <AppNav user={toPublicUser(user)} />
      <main className="flex-1 py-8">{children}</main>
    </div>
  );
}
