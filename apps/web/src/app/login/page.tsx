import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { AuthForm } from '@/components/auth/auth-form';
import { AuthShell } from '@/components/auth/auth-shell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'เข้าสู่ระบบ' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getCurrentUser()) redirect('/app');
  const { next } = await searchParams;
  // Only allow same-site redirects.
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/app';

  return (
    <AuthShell title="เข้าสู่ระบบ" subtitle="ยินดีต้อนรับกลับ — เอกสารของคุณรออยู่">
      <AuthForm mode="login" next={target} />
    </AuthShell>
  );
}
