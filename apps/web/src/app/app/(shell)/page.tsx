import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { ensurePlanFresh } from '@/lib/billing';
import { listDocuments } from '@/lib/documents';
import { getUsageSummary } from '@/lib/quota';
import { DocumentManager } from '@/components/app/document-manager';
import { getTranslator } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslator())('meta.documents') };
}

export default async function DashboardPage() {
  const user = await ensurePlanFresh(await requireUser());
  const [documents, usage] = await Promise.all([listDocuments(user.id), getUsageSummary(user)]);

  return (
    <DocumentManager
      initialDocuments={documents}
      initialUsage={usage}
      plan={user.plan}
    />
  );
}
