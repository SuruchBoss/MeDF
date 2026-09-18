import { z } from 'zod';
import { getCurrentUser, requireUser, toPublicUser } from '@/lib/auth';
import { startCheckout } from '@/lib/billing';
import { handleRouteError, jsonOk, parseJson } from '@/lib/api';

const schema = z.object({
  plan: z.enum(['pro', 'team']),
  interval: z.enum(['monthly', 'yearly']),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, schema);
    const result = await startCheckout({ user, plan: input.plan, interval: input.interval });
    const refreshed = await getCurrentUser();
    return jsonOk({
      ...result,
      user: refreshed ? toPublicUser(refreshed) : null,
    });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
