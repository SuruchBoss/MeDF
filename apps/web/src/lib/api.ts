import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError, QuotaError } from './errors';
import { translatorForRequest } from './i18n/server';
import type { Translate } from './i18n';

/** Shared JSON response helpers and a single place to map errors to statuses. */

export function jsonOk<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data as object, init);
}

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/**
 * Turns anything thrown inside a route handler into a JSON response.
 *
 * `request` is what makes the message readable: a domain error carries a key
 * and its parameters rather than a sentence, and this is the first point that
 * knows which language the caller asked for. Without it the error would be
 * rendered in the server's default language for everyone.
 */
export function handleRouteError(error: unknown, request?: Request): NextResponse {
  const t: Translate = translatorForRequest(
    request ?? new Request('http://localhost/', { headers: {} }),
  );

  if (error instanceof QuotaError) {
    return jsonError(t(error.key, error.params), error.status, {
      hint: t(error.hintKey),
      code: 'quota_exceeded',
    });
  }
  if (error instanceof AppError) {
    return jsonError(t(error.key, error.params), error.status);
  }
  if (error instanceof z.ZodError) {
    // Zod messages are already keys (see the schemas in `auth.ts`), so each one
    // goes through the translator the same way.
    const issues = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: translateIssue(issue.message, t),
    }));
    return jsonError(issues[0]?.message ?? t('api.invalidInput'), 422, { issues });
  }

  console.error('[medf] unhandled route error', error);
  return jsonError(t('api.unexpected'), 500);
}

/**
 * Zod carries a plain string, so a schema message may be one of our keys or a
 * message Zod generated itself ("Expected string, received number"). A key
 * round-trips through `t`; anything else is passed through untouched.
 */
function translateIssue(message: string, t: Translate): string {
  const translated = t(message as Parameters<Translate>[0]);
  return translated === message && !message.includes('.') ? message : translated;
}

/** Parses and validates a JSON request body. */
export async function parseJson<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new z.ZodError([
      { code: 'custom', message: 'api.badJson', path: [], input: undefined },
    ]);
  }
  return schema.parse(raw);
}
