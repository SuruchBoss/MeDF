import { requireUser } from '@/lib/auth';
import { ensurePlanFresh } from '@/lib/billing';
import { createAsset, getDocument } from '@/lib/documents';
import { handleRouteError, jsonError, jsonOk } from '@/lib/api';
import { translatorForRequest } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

/** Uploads an image for use by an `image` element. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const t = translatorForRequest(request);
    const user = await ensurePlanFresh(await requireUser());
    const { id } = await params;
    const document = await getDocument(user.id, id);

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return jsonError(t('api.assets.noImage'), 400);

    const width = Number(form.get('width') ?? 0);
    const height = Number(form.get('height') ?? 0);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return jsonError(t('api.assets.noSize'), 400);
    }

    const asset = await createAsset({
      user,
      documentId: document.id,
      bytes: new Uint8Array(await file.arrayBuffer()),
      mimeType: file.type,
      width,
      height,
    });

    return jsonOk({ asset }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
