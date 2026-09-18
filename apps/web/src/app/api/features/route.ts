import { getCurrentUser } from '@/lib/auth';
import { featureAvailability, proModuleInstalled } from '@/lib/pro';
import { handleRouteError, jsonOk } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * What the signed-in member can actually use on this installation. The UI uses
 * it to hide entry points for add-ons that are either not installed here or
 * not included in the member's plan.
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    const plan = user?.plan ?? 'free';
    return jsonOk({
      plan,
      proInstalled: proModuleInstalled(),
      features: featureAvailability({ plan }),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
