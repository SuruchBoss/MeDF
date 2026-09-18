'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ErrorScreen } from '@/components/error-screen';
import { useT } from '@/lib/i18n/provider';

/**
 * Signed-in area. Split from the root boundary so a failure here keeps the
 * member inside the app — the way out is their document list, not the
 * marketing site.
 */
export default function AppAreaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    console.error('[medf] error in the app area', error);
  }, [error]);

  return (
    <ErrorScreen
      code="500"
      title={t('error.appTitle')}
      description={t('error.appBody')}
      detail={error.digest ? t('error.reference', { digest: error.digest }) : undefined}
    >
      <button type="button" onClick={reset} className="btn-primary btn-sm">
        {t('common.retry')}
      </button>
      <Link href="/app" className="btn-secondary btn-sm">
        {t('error.myDocuments')}
      </Link>
    </ErrorScreen>
  );
}
