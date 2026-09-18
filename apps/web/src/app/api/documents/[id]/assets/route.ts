import { requireUser } from '@/lib/auth';
import { ensurePlanFresh } from '@/lib/billing';
import { createAsset, getDocument } from '@/lib/documents';
import { handleRouteError, jsonError, jsonOk } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** Uploads an image for use by an `image` element. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await ensurePlanFresh(await requireUser());
    const { id } = await params;
    const document = await getDocument(user.id, id);

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return jsonError('ไม่พบไฟล์รูปภาพ', 400);

    const width = Number(form.get('width') ?? 0);
    const height = Number(form.get('height') ?? 0);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return jsonError('ต้องส่งขนาดรูปภาพ (width, height) มาด้วย', 400);
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
    return handleRouteError(error);
  }
}
