'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon, Spinner } from '@/components/icons';
import { useHydrated } from '@/lib/client/use-hydrated';
import { useT } from '@/lib/i18n/provider';

interface AuthFormProps {
  mode: 'login' | 'register';
  /** Where to go after a successful submit. */
  next: string;
}

export function AuthForm({ mode, next }: AuthFormProps) {
  const router = useRouter();
  const t = useT();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Until React has attached its handlers, a click would submit the form
  // natively and look like nothing happened.
  const ready = useHydrated();

  const isRegister = mode === 'register';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(isRegister ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isRegister ? { name, email, password } : { email, password }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? t('auth.unknownError'));
        return;
      }
      // A full refresh makes the server components pick up the new session.
      router.replace(next);
      router.refresh();
    } catch {
      setError(t('auth.networkError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {isRegister ? (
        <div>
          <label className="label" htmlFor="name">
            {t('auth.displayName')}
          </label>
          <input
            id="name"
            className="field"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('auth.namePlaceholder')}
            autoComplete="name"
            required
            maxLength={80}
          />
        </div>
      ) : null}

      <div>
        <label className="label" htmlFor="email">
          {t('auth.email')}
        </label>
        <input
          id="email"
          type="email"
          className="field"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          {t('auth.password')}
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            className="field pr-11"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={isRegister ? t('auth.passwordMinPlaceholder') : '••••••••'}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            minLength={8}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-2 text-ink-400 pointer-coarse:min-h-11 pointer-coarse:min-w-11 hover:bg-ink-100 hover:text-ink-700"
            aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
          >
            <Icon name={showPassword ? 'eye-off' : 'eye'} size={17} />
          </button>
        </div>
        {isRegister ? (
          <p className="mt-1.5 text-xs text-ink-500">
            {t('auth.passwordHint')}
          </p>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700"
        >
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn-primary w-full py-3" disabled={busy || !ready}>
        {busy || !ready ? <Spinner size={17} /> : null}
        {isRegister ? t('auth.register') : t('auth.login')}
      </button>

      <p className="text-center text-sm text-ink-500">
        {isRegister ? (
          <>
            {t('auth.hasAccount')}{' '}
            <Link href="/login" className="font-semibold text-brand-600 hover:underline">
              {t('auth.login')}
            </Link>
          </>
        ) : (
          <>
            {t('auth.needsAccount')}{' '}
            <Link href="/register" className="font-semibold text-brand-600 hover:underline">
              {t('auth.registerShort')}
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
