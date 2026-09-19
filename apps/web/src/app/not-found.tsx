'use client';

import Link from 'next/link';
import { ErrorScreen } from '@/components/error-screen';
import { useT } from '@/lib/i18n/provider';

/**
 * A client component, because a static export cannot resolve the reader's
 * language on the server. `metadata` goes with it for the same reason — the
 * page title falls back to the layout's.
 */
export default function NotFound() {
  const t = useT();

  return (
    <ErrorScreen code="404" title={t('error.notFoundTitle')} description={t('error.notFoundBody')}>
      <Link href="/" className="btn-primary btn-sm">
        {t('error.toHome')}
      </Link>
      <Link href="/try" className="btn-secondary btn-sm">
        {t('error.myDocuments')}
      </Link>
    </ErrorScreen>
  );
}
