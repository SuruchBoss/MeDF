import { createUser, registerSchema, startSession, toPublicUser } from '@/lib/auth';
import { handleRouteError, jsonOk, parseJson } from '@/lib/api';

export async function POST(request: Request) {
  try {
    const input = await parseJson(request, registerSchema);
    const user = await createUser(input);
    await startSession(user);
    return jsonOk({ user: toPublicUser(user) }, { status: 201 });
  } catch (error) {
    return handleRouteError(error);
  }
}
