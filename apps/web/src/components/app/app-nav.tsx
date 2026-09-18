'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon, Logo, Spinner } from '@/components/icons';
import type { PublicUser } from '@/lib/auth';
import { PLANS } from '@/lib/plans';
import type { MessageKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/provider';

const NAV = [
  { href: '/app', label: 'appnav.documents' as MessageKey, icon: 'file-text' as const },
  { href: '/app/billing', label: 'appnav.billing' as MessageKey, icon: 'credit-card' as const },
  { href: '/app/account', label: 'appnav.account' as MessageKey, icon: 'user' as const },
];

export function AppNav({ user }: { user: PublicUser }) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const plan = PLANS[user.plan];

  const links = user.role === 'admin'
    ? [...NAV, { href: '/app/admin', label: 'appnav.admin' as MessageKey, icon: 'settings' as const }]
    : NAV;

  async function signOut() {
    setBusy(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/');
    router.refresh();
  }

  return (
    <header className="border-b border-ink-200 bg-white">
      <div className="container-page flex h-16 items-center gap-3 sm:gap-6">
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
                title={t(item.label)}
                aria-label={t(item.label)}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition ${
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
                }`}
              >
                <Icon name={item.icon} size={16} />
                <span className="hidden sm:inline">{t(item.label)}</span>
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
          title={t('appnav.planHint')}
        >
          {user.plan !== 'free' ? <Icon name="star" size={12} /> : null}
          {t('appnav.planBadge', { plan: plan.name })}
        </Link>

        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-ink-500 md:inline">{user.name}</span>
          <button
            type="button"
            onClick={signOut}
            className="btn-ghost btn-sm"
            disabled={busy}
            title={t('appnav.signOut')}
          >
            {busy ? <Spinner size={15} /> : <Icon name="logout" size={16} />}
            <span className="hidden sm:inline">{t('appnav.signOut')}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
