import { endSession } from '@/lib/auth';
import { handleRouteError, jsonOk } from '@/lib/api';

export async function POST(request: Request) {
  try {
    await endSession();
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
