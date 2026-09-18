import { requireUser } from '@/lib/auth';
import { ensurePlanFresh } from '@/lib/billing';
import { canUseFeature, loadProModule } from '@/lib/pro';
import { handleRouteError, jsonError } from '@/lib/api';
import { translatorForRequest } from '@/lib/i18n/server';

/**
 * Entry point for the paid add-on module.
 *
 * Every request is checked twice before any add-on code runs: the member must
 * be signed in, and their plan must entitle them to the feature the handler
 * declares. Nothing here reveals what the handlers do — that lives in the
 * private module (see `src/lib/pro.ts`).
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Params = { params: Promise<{ handler: string }> };

async function dispatch(request: Request, { params }: Params) {
  try {
    const t = translatorForRequest(request);
    const user = await ensurePlanFresh(await requireUser());
    const { handler: name } = await params;

    const addon = loadProModule();
    if (!addon) {
      return jsonError(t('api.pro.notInstalled'), 501, {
        code: 'pro_not_installed',
      });
    }

    // `name` comes from the URL, so look it up as an own property only:
    // `handlers['constructor']` would otherwise be a truthy function.
    const handlers = addon.server?.handlers;
    const handler = handlers && Object.hasOwn(handlers, name) ? handlers[name] : undefined;
    if (!handler) return jsonError(t('api.pro.notFound', { name }), 404);

    if (!canUseFeature(user, handler.feature)) {
      return jsonError(t('api.pro.featureLocked'), 402, {
        code: 'feature_locked',
        feature: handler.feature,
      });
    }

    return await handler.handle(request, user);
  } catch (error) {
    return handleRouteError(error, request);
  }
}

export const GET = dispatch;
export const POST = dispatch;
