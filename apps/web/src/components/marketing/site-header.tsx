'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon, Logo } from '@/components/icons';

const LINKS = [
  { href: '/#features', label: 'ฟีเจอร์' },
  { href: '/#how', label: 'วิธีใช้งาน' },
  { href: '/pricing', label: 'แพ็กเกจ' },
  { href: '/#desktop', label: 'ติดตั้งบน Windows' },
  { href: '/#faq', label: 'คำถามที่พบบ่อย' },
];

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-white/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href="/" className="text-ink-900">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-ink-100 hover:text-ink-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <Link href="/app" className="btn-primary">
              เข้าหน้าทำงาน
              <Icon name="arrow-right" size={16} />
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                เข้าสู่ระบบ
              </Link>
              <Link href="/register" className="btn-primary">
                เริ่มใช้ฟรี
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="btn-ghost md:hidden"
          aria-label="เปิดเมนู"
          aria-expanded={open}
        >
          <Icon name={open ? 'x' : 'menu'} size={22} />
        </button>
      </div>

      {open ? (
        <div className="border-t border-ink-200 bg-white md:hidden">
          <div className="container-page flex flex-col gap-1 py-3">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-ink-100"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2">
              {signedIn ? (
                <Link href="/app" className="btn-primary flex-1">
                  เข้าหน้าทำงาน
                </Link>
              ) : (
                <>
                  <Link href="/login" className="btn-secondary flex-1">
                    เข้าสู่ระบบ
                  </Link>
                  <Link href="/register" className="btn-primary flex-1">
                    เริ่มใช้ฟรี
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
