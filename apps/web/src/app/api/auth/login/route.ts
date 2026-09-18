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

export async function POST(request: Request) {
  let rateKey = 'unknown';
  try {
    const input = await parseJson(request, credentialsSchema);
    // Rate-limit per e-mail *and* per client address.
    const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
    rateKey = `${input.email.toLowerCase()}|${address}`;
    checkLoginRate(rateKey);

    const user = await authenticate(input.email, input.password);
    clearLoginFailures(rateKey);
    await startSession(user);
    return jsonOk({ user: toPublicUser(user) });
  } catch (error) {
    if (error instanceof Error && error.name === 'AuthError') recordLoginFailure(rateKey);
    return handleRouteError(error, request);
  }
}
