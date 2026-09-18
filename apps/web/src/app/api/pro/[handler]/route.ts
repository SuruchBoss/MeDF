import { requireUser } from '@/lib/auth';
import { ensurePlanFresh } from '@/lib/billing';
import { canUseFeature, loadProModule } from '@/lib/pro';
import { handleRouteError, jsonError } from '@/lib/api';

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
    const user = await ensurePlanFresh(await requireUser());
    const { handler: name } = await params;

    const addon = loadProModule();
    if (!addon) {
      return jsonError('เซิร์ฟเวอร์นี้ไม่ได้ติดตั้งโมดูลฟีเจอร์เสริม', 501, {
        code: 'pro_not_installed',
      });
    }

    // `name` comes from the URL, so look it up as an own property only:
    // `handlers['constructor']` would otherwise be a truthy function.
    const handlers = addon.server?.handlers;
    const handler = handlers && Object.hasOwn(handlers, name) ? handlers[name] : undefined;
    if (!handler) return jsonError(`ไม่พบฟีเจอร์ "${name}"`, 404);

    if (!canUseFeature(user, handler.feature)) {
      return jsonError('ฟีเจอร์นี้ต้องอัปเกรดแพ็กเกจก่อนใช้งาน', 402, {
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
