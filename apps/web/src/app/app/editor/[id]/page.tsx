import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { ensurePlanFresh } from '@/lib/billing';
import { DocumentError, getDocument, readOverlay } from '@/lib/documents';
import type { DocumentRecord } from '@/lib/db';
import type { OverlayDoc } from '@/lib/editor-types';
import { getPlan } from '@/lib/plans';
import { EditorScreen } from '@/components/editor/editor-screen';
import { getTranslator } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslator())('meta.editor') };
}

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await ensurePlanFresh(await requireUser());
  const { id } = await params;

  // Load first, render after: JSX built inside a try/catch would not have its
  // render-time errors caught there anyway.
  let document: DocumentRecord;
  let overlay: OverlayDoc;
  try {
    document = await getDocument(user.id, id);
    overlay = await readOverlay(document);
  } catch (error) {
    if (error instanceof DocumentError && (error.status === 404 || error.status === 403)) {
      notFound();
    }
    throw error;
  }

  const plan = getPlan(user.plan);

  return (
    <EditorScreen
      documentId={document.id}
      title={document.title}
      revision={document.revision}
      overlay={overlay}
      plan={user.plan}
      watermark={plan.limits.watermark}
    />
  );
}
