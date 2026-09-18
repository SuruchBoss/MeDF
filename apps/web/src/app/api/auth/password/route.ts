import { z } from 'zod';
import { requireUser, updatePassword } from '@/lib/auth';
import { handleRouteError, jsonOk, parseJson } from '@/lib/api';
import { translatorForRequest } from '@/lib/i18n/server';

const schema = z.object({
  currentPassword: z.string().min(1, 'api.auth.currentPasswordRequired'),
  newPassword: z.string().min(8, 'api.auth.newPasswordLength').max(200),
});

export async function POST(request: Request) {
  try {
    const t = translatorForRequest(request);
    const user = await requireUser();
    const input = await parseJson(request, schema);
    await updatePassword(user.id, input.currentPassword, input.newPassword);
    return jsonOk({ ok: true, message: t('api.auth.passwordChanged') });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
