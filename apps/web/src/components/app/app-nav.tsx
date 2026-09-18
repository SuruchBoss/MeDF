'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon, Logo, Spinner } from '@/components/icons';
import type { PublicUser } from '@/lib/auth';
import { PLANS } from '@/lib/plans';

const NAV = [
  { href: '/app', label: 'เอกสารของฉัน', icon: 'file-text' as const },
  { href: '/app/billing', label: 'การสมัครสมาชิก', icon: 'credit-card' as const },
  { href: '/app/account', label: 'บัญชีของฉัน', icon: 'user' as const },
];

export function AppNav({ user }: { user: PublicUser }) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const plan = PLANS[user.plan];

  const links = user.role === 'admin'
    ? [...NAV, { href: '/app/admin', label: 'ผู้ดูแลระบบ', icon: 'settings' as const }]
    : NAV;

  async function signOut() {
    setBusy(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/');
    router.refresh();
  }

  return (
    <header className="border-b border-ink-200 bg-white">
      <div className="container-page flex h-16 items-center gap-6">
        <Link href="/" className="text-ink-900">
          <Logo />
        </Link>

        <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
          {links.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
                }`}
              >
                <Icon name={item.icon} size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/app/billing"
          className={`badge hidden sm:inline-flex ${
            user.plan === 'free'
              ? 'bg-ink-100 text-ink-600 hover:bg-ink-200'
              : 'bg-brand-600 text-white hover:bg-brand-700'
          }`}
          title="ดูรายละเอียดแพ็กเกจ"
        >
          {user.plan !== 'free' ? <Icon name="star" size={12} /> : null}
          แพ็กเกจ {plan.name}
        </Link>

        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-ink-500 md:inline">{user.name}</span>
          <button
            type="button"
            onClick={signOut}
            className="btn-ghost btn-sm"
            disabled={busy}
            title="ออกจากระบบ"
          >
            {busy ? <Spinner size={15} /> : <Icon name="logout" size={16} />}
            <span className="hidden sm:inline">ออกจากระบบ</span>
          </button>
        </div>
      </div>
    </header>
  );
}
