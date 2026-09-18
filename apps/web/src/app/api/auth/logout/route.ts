import { endSession } from '@/lib/auth';
import { handleRouteError, jsonOk } from '@/lib/api';

export async function POST() {
  try {
    await endSession();
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
