import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ensurePlanFresh } from '@/lib/billing';
import {
  deleteDocument,
  getDocument,
  pruneUnusedAssets,
  readOverlay,
  renameDocument,
  saveOverlay,
} from '@/lib/documents';
import { overlaySchema } from '@/lib/editor-types';
import { handleRouteError, jsonError, jsonOk, parseJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  try {
    const user = await ensurePlanFresh(await requireUser());
    const { id } = await params;
    const document = await getDocument(user.id, id);
    const overlay = await readOverlay(document);
    return jsonOk({ document, overlay });
  } catch (error) {
    return handleRouteError(error, request);
  }
}

const patchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  overlay: overlaySchema.optional(),
  /** Revision the client started from; guards against overwriting newer work. */
  baseRevision: z.number().int().nonnegative().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  try {
    const user = await ensurePlanFresh(await requireUser());
    const { id } = await params;
    let document = await getDocument(user.id, id);
    const input = await parseJson(request, patchSchema);

    if (input.title) document = await renameDocument(document, input.title);

    if (input.overlay) {
      if (
        input.baseRevision != null &&
        input.baseRevision !== document.revision &&
        input.baseRevision !== 0
      ) {
        return jsonError(
          'เอกสารนี้ถูกแก้ไขจากอุปกรณ์อื่นแล้ว กรุณารีเฟรชหน้าก่อนบันทึก',
          409,
          { code: 'revision_conflict', revision: document.revision },
        );
      }
      document = await saveOverlay(document, input.overlay);
      await pruneUnusedAssets(document, input.overlay);
    }

    return jsonOk({ document });
  } catch (error) {
    return handleRouteError(error, request);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const document = await getDocument(user.id, id);
    await deleteDocument(document);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
