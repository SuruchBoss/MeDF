import { requireUser, toPublicUser } from '@/lib/auth';
import { cancelSubscription } from '@/lib/billing';
import { handleRouteError, jsonOk } from '@/lib/api';

export async function POST() {
  try {
    const user = await requireUser();
    const updated = await cancelSubscription(user);
    return jsonOk({ user: toPublicUser(updated) });
  } catch (error) {
    return handleRouteError(error);
  }
}
