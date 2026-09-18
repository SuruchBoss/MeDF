import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

/**
 * Auth guard for everything under `/app`. Deliberately renders no chrome so
 * the editor can use the whole viewport; `(shell)/layout.tsx` adds the nav for
 * the regular screens.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/app');
  return <>{children}</>;
}
