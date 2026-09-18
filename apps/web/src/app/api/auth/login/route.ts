import {
  authenticate,
  checkLoginRate,
  clearLoginFailures,
  credentialsSchema,
  recordLoginFailure,
  startSession,
  toPublicUser,
} from '@/lib/auth';
import { handleRouteError, jsonOk, parseJson } from '@/lib/api';
import { AuthError } from '@/lib/errors';

export async function POST(request: Request) {
  let rateKey = 'unknown';
  try {
    const input = await parseJson(request, credentialsSchema);
    // Rate-limit per e-mail *and* per client address.
    const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
    rateKey = `${input.email.toLowerCase()}|${address}`;
    await checkLoginRate(rateKey);

    const user = await authenticate(input.email, input.password);
    await clearLoginFailures(rateKey);
    await startSession(user);
    return jsonOk({ user: toPublicUser(user) });
  } catch (error) {
    // `instanceof`, not `error.name`: the production build renames classes, so
    // the name check silently stopped counting failed sign-ins there.
    if (error instanceof AuthError) await recordLoginFailure(rateKey);
    return handleRouteError(error, request);
  }
}
