'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ErrorScreen } from '@/components/error-screen';
import { useT } from '@/lib/i18n/provider';

/**
 * Catches a render or data error anywhere under the root layout.
 *
 * `error.message` is deliberately not shown: in a production build Next
 * replaces it with a generic string anyway, and in development the overlay
 * already shows the real one. The digest is shown because it is the id that
 * matches this failure to the server log.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();

  useEffect(() => {
    console.error('[medf] unhandled error', error);
  }, [error]);

  return (
    <ErrorScreen
      code="500"
      title={t('error.unexpectedTitle')}
      description={t('error.unexpectedBody')}
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
