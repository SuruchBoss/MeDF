import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { ensurePlanFresh } from '@/lib/billing';
import {
  assetLoaderFor,
  getDocument,
  readDocumentBytes,
  readOverlay,
  saveOverlay,
} from '@/lib/documents';
import { overlaySchema } from '@/lib/editor-types';
import { getPlan } from '@/lib/plans';
import { assertCanExport, recordUsage } from '@/lib/quota';
import { nodeFontLoader } from '@/lib/pdf/fonts-node';
import { renderOverlayToPdf } from '@/lib/pdf/render';
import { applyProExportTransform } from '@/lib/pro';
import { handleRouteError, parseJson } from '@/lib/api';

/**
 * Exports the edited document.
 *
 * Rendering happens on the server so plan limits (export quota, the free-plan
 * footer) cannot be bypassed by a modified client, and so the browser never has
 * to hold the whole output in memory.
 */

export const dynamic = 'force-dynamic';
// Large documents with many images can take a while to compose.
export const maxDuration = 120;

const schema = z.object({
  /** Optional unsaved overlay: export exactly what the member sees. */
  overlay: overlaySchema.optional(),
  /** Persist the overlay as part of exporting. */
  save: z.boolean().default(true),
  fileName: z.string().max(200).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await ensurePlanFresh(await requireUser());
    const { id } = await params;
    const document = await getDocument(user.id, id);
    const input = await parseJson(request, schema);

    await assertCanExport(user);

    const overlay = input.overlay ?? (await readOverlay(document));
    if (input.overlay && input.save) {
      await saveOverlay(document, input.overlay);
    }

    const source = await readDocumentBytes(document);
    const plan = getPlan(user.plan);

    const result = await renderOverlayToPdf({
      source: new Uint8Array(source),
      overlay,
      loadAsset: assetLoaderFor(user.id),
      fontLoader: nodeFontLoader,
      watermark: plan.limits.watermark,
      title: document.title,
      author: user.name,
    });

    // Paid add-ons may post-process the file (OCR, redaction, compression).
    // Without an installed module this returns the bytes untouched.
    const bytes = await applyProExportTransform(
      result.bytes,
      {
        user: { id: user.id, plan: user.plan },
        overlay,
        documentTitle: document.title,
      },
      user,
    );

    await recordUsage(user.id, 'export', document.id);

    const baseName = (input.fileName ?? document.title).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);
    const fileName = `${baseName || 'medf-export'}.pdf`;

    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(bytes.byteLength),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Cache-Control': 'no-store',
        'X-Medf-Pages': String(result.pageCount),
        'X-Medf-Skipped-Assets': String(result.skipped.length),
      },
    });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
