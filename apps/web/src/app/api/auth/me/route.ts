import { getCurrentUser, toPublicUser } from '@/lib/auth';
import { ensurePlanFresh } from '@/lib/billing';
import { getUsageSummary } from '@/lib/quota';
import { handleRouteError, jsonOk } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const current = await getCurrentUser();
    if (!current) return jsonOk({ user: null, usage: null });
    const user = await ensurePlanFresh(current);
    return jsonOk({ user: toPublicUser(user), usage: await getUsageSummary(user) });
  } catch (error) {
    return handleRouteError(error);
  }
}
