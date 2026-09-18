import { requireUser } from '@/lib/auth';
import { ensurePlanFresh } from '@/lib/billing';
import { duplicateDocument, getDocument } from '@/lib/documents';
import { handleRouteError, jsonOk } from '@/lib/api';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await ensurePlanFresh(await requireUser());
    const { id } = await params;
    const source = await getDocument(user.id, id);
    const copy = await duplicateDocument(user, source);
    return jsonOk({ document: copy }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
