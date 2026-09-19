import Link from 'next/link';
import { ErrorScreen } from '@/components/error-screen';
import type { Metadata } from 'next';
import { getTranslator } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslator())('meta.notFound') };
}

export default async function NotFound() {
  const t = await getTranslator();

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
