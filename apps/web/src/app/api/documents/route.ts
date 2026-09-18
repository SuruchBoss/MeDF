import { requireUser } from '@/lib/auth';
import { ensurePlanFresh } from '@/lib/billing';
import { createDocument, listDocuments } from '@/lib/documents';
import { getUsageSummary } from '@/lib/quota';
import { handleRouteError, jsonError, jsonOk } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = await ensurePlanFresh(await requireUser());
    const [documents, usage] = await Promise.all([listDocuments(user.id), getUsageSummary(user)]);
    return jsonOk({ documents, usage });
  } catch (error) {
    return handleRouteError(error, request);
  }
}

/** Upload a PDF as multipart/form-data with a `file` field. */
export async function POST(request: Request) {
  try {
    const user = await ensurePlanFresh(await requireUser());
    const form = await request.formData();
    const file = form.get('file');

    if (!(file instanceof File)) {
      return jsonError('ไม่พบไฟล์ที่อัปโหลด (ต้องส่งฟิลด์ชื่อ "file")', 400);
    }
    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) return jsonError('รองรับเฉพาะไฟล์ PDF', 415);

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength === 0) return jsonError('ไฟล์ว่างเปล่า', 400);

    const title = form.get('title');
    const document = await createDocument({
      user,
      bytes,
      fileName: file.name || 'document.pdf',
      title: typeof title === 'string' ? title : undefined,
    });

    return jsonOk({ document }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
