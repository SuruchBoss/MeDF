import { requireUser } from '@/lib/auth';
import { getAsset, readAssetBytes } from '@/lib/documents';
import { handleRouteError } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const asset = await getAsset(user.id, id);
    const bytes = await readAssetBytes(asset);

    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': asset.mimeType,
        'Content-Length': String(bytes.byteLength),
        // Assets are immutable once uploaded.
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
