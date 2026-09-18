import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/icons';

/**
 * The page a member sees when something has gone wrong.
 *
 * Next's own error screen is an English stack trace, so every boundary in the
 * app renders this instead: the same brand, Thai copy, and a way back. It is a
 * server component with no state, so it works inside `global-error.tsx` too,
 * where the app's own layout is already gone.
 */
export function ErrorScreen({
  code,
  title,
  description,
  detail,
  children,
}: {
  /** Shown large, e.g. `404`. */
  code: string;
  title: string;
  description: string;
  /** Technical detail — only ever rendered when there is something safe to show. */
  detail?: string;
  children?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink-50 px-6 py-16 text-center">
      <Link href="/" aria-label="MeDF">
        <Logo />
      </Link>

      <p className="text-6xl font-extrabold tracking-tight text-brand-600 sm:text-7xl">{code}</p>

      <div className="max-w-md space-y-2">
        <h1 className="text-xl font-bold text-ink-900">{title}</h1>
        <p className="text-sm leading-relaxed text-ink-600">{description}</p>
      </div>

      {detail ? (
        <pre className="max-w-lg overflow-x-auto rounded-xl bg-ink-100 px-4 py-3 text-left text-[11px] leading-relaxed text-ink-600">
          {detail}
        </pre>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-3">{children}</div>
    </main>
  );
}
