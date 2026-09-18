import { requireUser } from '@/lib/auth';
import { getDocument, readDocumentBytes } from '@/lib/documents';
import { handleRouteError } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** Streams the original uploaded PDF, for rendering in the editor. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const document = await getDocument(user.id, id);
    const bytes = await readDocumentBytes(document);

    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'private, max-age=3600',
        'Content-Disposition': `inline; filename="${encodeURIComponent(document.originalFileName)}"`,
      },
    });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
