import { requireUser, toPublicUser } from '@/lib/auth';
import { resumeSubscription } from '@/lib/billing';
import { handleRouteError, jsonOk } from '@/lib/api';

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const updated = await resumeSubscription(user);
    return jsonOk({ user: toPublicUser(updated) });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
